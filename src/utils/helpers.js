// File type utility functions
exports.getFileTypeClass = (filename) => {
  if (!filename) return "";

  const extension = filename.split(".").pop().toLowerCase();

  // Map file extensions to type classes
  const imageTypes = ["jpg", "jpeg", "png", "gif", "svg", "webp"];
  const documentTypes = ["doc", "docx", "txt", "rtf", "odt"];
  const pdfTypes = ["pdf"];
  const archiveTypes = ["zip", "rar", "tar", "gz", "7z"];
  const audioTypes = ["mp3", "wav", "ogg", "flac", "m4a"];
  const videoTypes = ["mp4", "avi", "mov", "wmv", "mkv", "webm"];
  const codeTypes = [
    "js",
    "html",
    "css",
    "py",
    "java",
    "php",
    "c",
    "cpp",
    "json",
  ];

  if (imageTypes.includes(extension)) return "image";
  if (documentTypes.includes(extension)) return "document";
  if (pdfTypes.includes(extension)) return "pdf";
  if (archiveTypes.includes(extension)) return "archive";
  if (audioTypes.includes(extension)) return "audio";
  if (videoTypes.includes(extension)) return "video";
  if (codeTypes.includes(extension)) return "code";

  return "";
};
