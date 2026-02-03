import {getStorage} from 'firebase-admin/storage';
import {v4 as uuidv4} from 'uuid';
import path from 'path';
import attachmentRepository from '../repositories/attachmentRepository';

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Service for handling file uploads to Firebase Cloud Storage
 */
const fileUploadService = {
  /**
   * Upload a file to Cloud Storage
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.messageId
   * @param {Buffer|string} params.fileBuffer
   * @param {string} params.filename
   * @param {string} params.contentType
   * @param {number} params.size
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async uploadFile({organizationId, messageId, fileBuffer, filename, contentType, size}) {
    // Validate file type
    if (!ALLOWED_TYPES[contentType]) {
      return {
        success: false,
        error: `File type ${contentType} is not allowed. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
      };
    }

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    try {
      const bucket = getStorage().bucket();
      const fileId = uuidv4();
      const extension = ALLOWED_TYPES[contentType] || path.extname(filename);
      const storagePath = `organizations/${organizationId}/attachments/${fileId}${extension}`;

      const file = bucket.file(storagePath);

      // Upload the file
      await file.save(fileBuffer, {
        metadata: {
          contentType,
          metadata: {
            organizationId,
            messageId,
            originalName: filename
          }
        }
      });

      // Make the file publicly accessible (or use signed URLs for private access)
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Create attachment record
      const attachment = await attachmentRepository.create({
        organizationId,
        messageId,
        filename,
        contentType,
        size,
        storageUrl: publicUrl,
        storagePath
      });

      return {
        success: true,
        data: attachment
      };
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: 'Failed to upload file'
      };
    }
  },

  /**
   * Upload multiple files
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.messageId
   * @param {Array<{buffer: Buffer, filename: string, contentType: string, size: number}>} params.files
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async uploadMultipleFiles({organizationId, messageId, files}) {
    if (!files || files.length === 0) {
      return {success: true, data: []};
    }

    const results = await Promise.all(
      files.map(file =>
        this.uploadFile({
          organizationId,
          messageId,
          fileBuffer: file.buffer,
          filename: file.filename,
          contentType: file.contentType,
          size: file.size
        })
      )
    );

    const successful = results.filter(r => r.success).map(r => r.data);
    const failed = results.filter(r => !r.success);

    if (failed.length > 0 && successful.length === 0) {
      return {
        success: false,
        error: failed[0].error
      };
    }

    return {
      success: true,
      data: successful
    };
  },

  /**
   * Delete a file from Cloud Storage
   * @param {string} attachmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteFile(attachmentId) {
    try {
      const attachment = await attachmentRepository.getById(attachmentId);
      if (!attachment) {
        return {success: false, error: 'Attachment not found'};
      }

      const bucket = getStorage().bucket();
      const file = bucket.file(attachment.storagePath);

      await file.delete();
      await attachmentRepository.delete(attachmentId);

      return {success: true};
    } catch (error) {
      console.error('File delete error:', error);
      return {
        success: false,
        error: 'Failed to delete file'
      };
    }
  },

  /**
   * Generate a signed URL for temporary access
   * @param {string} attachmentId
   * @param {number} expiresInMinutes
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  async getSignedUrl(attachmentId, expiresInMinutes = 60) {
    try {
      const attachment = await attachmentRepository.getById(attachmentId);
      if (!attachment) {
        return {success: false, error: 'Attachment not found'};
      }

      const bucket = getStorage().bucket();
      const file = bucket.file(attachment.storagePath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000
      });

      return {success: true, data: url};
    } catch (error) {
      console.error('Signed URL error:', error);
      return {
        success: false,
        error: 'Failed to generate signed URL'
      };
    }
  },

  /**
   * Get allowed file types
   * @returns {Object}
   */
  getAllowedTypes() {
    return ALLOWED_TYPES;
  },

  /**
   * Get max file size
   * @returns {number}
   */
  getMaxFileSize() {
    return MAX_FILE_SIZE;
  }
};

export default fileUploadService;
