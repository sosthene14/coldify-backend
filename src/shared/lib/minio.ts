import { Client } from "minio";

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "",
  secretKey: process.env.MINIO_SECRET_KEY || "",
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "so-mails-assets";

/**
 * Initialise le bucket MinIO au démarrage de l'app
 */
export async function initMinIO() {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, process.env.MINIO_REGION || "us-east-1");
      console.log(`✅ MinIO bucket "${BUCKET_NAME}" created`);
    } else {
      console.log(`✅ MinIO bucket "${BUCKET_NAME}" already exists`);
    }

    // Configurer la politique pour rendre les images privées par défaut
    // Les images ne seront accessibles que via des URLs signées
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Deny",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    console.log(`✅ MinIO bucket policy configured (private)`);
  } catch (error) {
    console.error("❌ MinIO initialization error:", error);
    throw error;
  }
}

export { minioClient, BUCKET_NAME };
