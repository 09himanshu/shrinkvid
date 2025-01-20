# NodeJS Service with Docker, MongoDB, and AWS S3
### This project is a NodeJS service that runs within a Docker container, leveraging MongoDB for database operations and AWS S3 for file storage and retrieval. The service continuously processes and compresses MP4 files, facilitating efficient storage.

### Features
- **Database Connection**: Establishes a connection to MongoDB.
- **Cloud Storage Integration**: Connects to AWS S3 for file retrieval and storage.
- **Continuous Processing**: Runs in an infinite loop to continuously process files.
- **File Compression**: Compresses MP4 files into a readable stream.
- **Local and Cloud Storage Management**: Writes compressed files to local storage and uploads them to AWS S3.
- **Automated Cleanup**: Removes compressed files from local storage after successful upload.
- **Configurable Sleep**: Pauses for a configurable duration before processing the next file.

### Prerequisites
- Docker
- MongoDB
- AWS Account with S3 bucket access

## Getting Started
Installation
Clone the repository:

`bash`
```
git clone <repository-url>
cd <repository-directory>
```

### Pass The Environment Variables At Run Time
- **mongourl**: MongoDB connection string.
- **accessKeyId**: AWS access key ID.
- **secretAccessKey**: AWS secret access key.
- **region**: AWS region.
- **bucket**: S3 bucket name.

### Build and run the Docker container:

`bash`
```
docker build -t <image_name> .
```

`bash`
```
docker run -d \
-e mongourl=<your mongourl>
-e accessKeyId=<your accessKeyId>
-e secretAccessKey=<your secretAccessKey>
-e region=<your bucket region>
-e bucket=<your bucket name>
<image_name>
```
### Configuration
- **MongoDB**: Ensure MongoDB is running and accessible.
- **AWS S3**: Configure AWS credentials and S3 bucket details.

### The service will:

- Connect to MongoDB.
- Connect to AWS S3.
- Enter an infinite loop to:
  - Retrieve S3 file paths from the MongoDB database.
  - Pull the objects from AWS S3.
  - Compress MP4 files and create a readable stream.
  - Write the compressed files to the local server.
  - Upload the compressed files to the AWS S3 bucket with the original file path and remove the previous file.
  - Remove the compressed files from the local server.
  - Sleep for 5 seconds before processing the next file.

### Contributing
Feel free to open issues or submit pull requests for any improvements or bug fixes.
