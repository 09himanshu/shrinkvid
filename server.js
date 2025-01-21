import ffmpeg from 'fluent-ffmpeg'
import AWS from 'aws-sdk'
import fs from 'fs'
import { Database } from './db.js'

let accessKeyId = process.env.accessKeyId
let secretAccessKey = process.env.secretAccessKey
let region = process.env.region
let bucket = process.env.bucket
let mongourl = process.env.mongourl

AWS.config.update({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: region
})

const s3 = new AWS.S3()
const db = new Database(mongourl)


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const get_db_data = async () => {
  try {
    let data = await db.aggegrate({
      collection: '_med_contents',
      filter: [
        {
          $match: {
            compress: {
              $exists: false
            }
          }
        },
        {
          $lookup: {
            from: 'files_checksum',
            localField: 'sessionId',
            foreignField: 'sessionId',
            as: 'result'
          }
        },
        {
          $unwind: {
            path: '$result',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $project: {
            result: 1
          }
        }
      ]
    })
    
    return data
  } catch (err) {
    console.log(err);
  }
}

const compress_S3_Video = async () => {
  try {

    let count = 0

    while (true) {

      let db_data = await get_db_data()
      if (!db_data.length) {
        await sleep(60000)
        continue
      }

      for (let ele of db_data) {
        try {
          console.log(++count);
          let outputFilePath = `${Date.now()}.mp4`;

          const readStream = s3.getObject({
            Bucket: bucket,
            Key: ele.result.s3Key
          }).createReadStream();

          await new Promise((resolve, reject) => {
            ffmpeg(readStream)
              .outputOptions([
                '-vcodec libx264',
                '-preset slow',
                '-crf 23',
                '-b:a 128k',
                '-movflags +faststart',
                '-vf scale=w=1280:h=720',
              ])
              .on('start', (command) => console.log(`Started: ${command}`))
              .on('progress', (progress) => {
                // console.log(`Progress: ${progress.percent ? progress.percent.toFixed(2) : '0'}%`);
              })
              .on('end', () => {
                resolve(); 
              })
              .on('error', (err) => {
                reject(err);
              })
              .saveToFile(outputFilePath);
          });

          await chunk_upload_file(outputFilePath, ele.result.s3Key)

          fs.unlinkSync(outputFilePath)
          console.log('Sleeping for 1 minute...');
          await sleep(60000);
        } catch (err) {
          console.log(err);
          await sleep(60000);
          continue
        }
      }
    }
  } catch (err) {
    console.log(err);
    process.exit(0)
  }
}


const createMultipartUpload = async (key) => {
  try {
    const params = { Bucket: bucket, Key: key };
    let createUpload = await s3.createMultipartUpload(params).promise();
    return createUpload.UploadId;
  } catch (err) {
    console.log('Error creating multipart upload:', err);
  }
};

const completeMultipartUpload = async (key, uploadId, parts) => {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
      MultipartUpload: { Parts: parts },
      UploadId: uploadId
    };
    return s3.completeMultipartUpload(params).promise();
  } catch (err) {
    console.log('Error completing multipart upload:', err);
  }
};

const chunk_upload_file = async (filename, key) => {
  try {
    let uploadParts = [];
    const chunkSize = 30 * 1024 * 1024; // 30 MB
    // let key = 'upload/mufasa.mp4'

    let readableStream = fs.createReadStream(filename);
    let uploadId = await createMultipartUpload(key);
    console.log(uploadId);

    let buffer = Buffer.alloc(0);
    let partNumber = 1;

    // Function to handle upload chunk process
    const uploadChunk = async (partBuffer, partNum) => {
      console.log(`Uploading part ${partNum}`);
      const params = {
        Bucket: bucket,
        Key: key,
        PartNumber: partNum,
        UploadId: uploadId,
        Body: partBuffer
      };

      let partResponse = await s3.uploadPart(params).promise();
      uploadParts.push({
        ETag: partResponse.ETag,
        PartNumber: partNum
      });
    };

    let uploadPromises = [];

    // Reading chunks from the file
    for await (let chunk of readableStream) {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length >= chunkSize) {
        let partBuffer = buffer.slice(0, chunkSize);
        uploadPromises.push(uploadChunk(partBuffer, partNumber));
        partNumber++;
        buffer = buffer.slice(chunkSize);

        // Limit to 5 parallel uploads
        if (uploadPromises.length >= 5) {
          await Promise.all(uploadPromises);
          uploadPromises = [];
          console.log(uploadParts);
          
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.length) {
      uploadPromises.push(uploadChunk(buffer, partNumber));
    }

    // Make sure all remaining uploads are completed
    await Promise.all(uploadPromises);

    
    uploadParts.sort((a,b) => a.PartNumber-b.PartNumber)
    console.log('Uploaded parts:', uploadParts);

    // Complete multipart upload
    await completeMultipartUpload(key, uploadId, uploadParts);

    // Get a signed URL to access the uploaded file
    const params = { Bucket: bucket, Key: key, Expires: 60 };
    const link = s3.getSignedUrl('getObject', params);
    console.log('Uploaded file URL:', link);
  } catch (err) {
    console.log('Error in chunk_upload_file:', err);
  }
};


// await chunk_upload_file()

await compress_S3_Video()