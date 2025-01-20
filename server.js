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

const compress_S3_Video = async () => {
  try {

    let count = 0

    while (true) {
      let data1 = await db.aggegrate({
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

      if (!data1) continue

      for (let ele of data1) {
        try {
          console.log(++count);

          let data = await db.findOne({
            collection: 'files_checksum',
            filter: { sessionId: ele.result.sessionId }
          });

          if (!data) continue;
          let outputFilePath = `${Date.now()}.mp4`;

          const readStream = s3.getObject({
            Bucket: bucket,
            Key: data.s3Key
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

          console.log('Sleeping for 1 minute...');
          await sleep(60000);
        } catch (err) {
          console.log(err);
          continue
        }
      }
    }
  } catch (err) {
    console.log(err);
    process.exit(0)
  }
}

// await compress_S3_Video()

const createMultipartUpload = async (key) => {
  try {
    const params = {
      Bucket: bucket,
      Key: key
    }

    let createUpload = await s3.createMultipartUpload(params).promise()
    return createUpload.UploadId
  } catch (err) {
    console.log(err);
  }
}

const completeMultipartUpload = async (key, uploadId, parts) => {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
      MultipartUpload: {
        Parts: parts
      },
      UploadId: uploadId
    }

    return s3.completeMultipartUpload(params).promise()
  } catch (err) {
    console.log(err);
    
  }
}

const chunk_upload_file = async () => {
  try {
    let key = `test/mufasa.mp4`
    let uploadParts = []
    let partNumber = 1
    let buffer = Buffer.alloc(0)
    const chunkSize = 30 * 1024 * 1024 // 30 MB
    
    let readableStream = fs.createReadStream('Mufasa.mp4') 

    let uploadId = await createMultipartUpload(key)
    console.log(uploadId);
    

    for await (let ele of readableStream) {
      buffer = Buffer.concat([buffer,ele])
      if(buffer.length >= chunkSize) {
        let part = buffer.slice(0,chunkSize)
        const params = {
          Bucket: bucket,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: part
        }

        try {
          const uploadPart = await s3.uploadPart(params).promise()
          console.log(partNumber);
          
          uploadParts.push(
            {
              Etag: uploadPart.ETag,
              PartNumber: partNumber
            }
          )
          partNumber++
          buffer = buffer.slice(chunkSize)
        } catch (err) {
          console.log(err);
          return
        }
      }
    }

    if(buffer.length) {
      let part = buffer.slice(0, chunkSize)
      const params = {
        Bucket: bucket,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: part
      }

      try {
        const uploadPart = await s3.uploadPart(params).promise()
        uploadParts.push(
          {
            ETag: uploadPart.ETag,
            PartNumber: partNumber
          }
        )
      } catch (err) {
        console.log(err);
        return
      }
    }

    await completeMultipartUpload(KeyObject, uploadId, uploadParts)

    let link = await s3.getSignedUrl('getObject',{
      Bucket: bucket,
      Key: key
    })
    console.log('==================', link)
  } catch (err) {
    console.log(err);
    
  }
}


await chunk_upload_file()