import imageCompression from 'browser-image-compression';

export const uploadImage = async (file) => {
  try {
    // Compress image
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    });

    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('upload_preset', 'futa-marketplace');
    formData.append('cloud_name', 'dubb7rhoy');
    formData.append('folder', 'futa-marketplace');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dubb7rhoy/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) throw new Error('Upload failed');
    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};