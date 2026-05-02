const fs = require("fs");

const normalizeReadlinkError = (error) => {
  if (error && error.code === "EISDIR" && error.syscall === "readlink") {
    error.code = "EINVAL";
  }
  return error;
};

const originalReadlink = fs.readlink;
fs.readlink = function patchedReadlink(path, options, callback) {
  if (typeof options === "function") {
    return originalReadlink.call(fs, path, (error, linkString) => {
      options(normalizeReadlinkError(error), linkString);
    });
  }

  return originalReadlink.call(fs, path, options, (error, linkString) => {
    callback(normalizeReadlinkError(error), linkString);
  });
};

const originalReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return originalReadlinkSync.call(fs, path, options);
  } catch (error) {
    throw normalizeReadlinkError(error);
  }
};

if (fs.promises && fs.promises.readlink) {
  const originalPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function patchedPromisesReadlink(path, options) {
    try {
      return await originalPromisesReadlink.call(fs.promises, path, options);
    } catch (error) {
      throw normalizeReadlinkError(error);
    }
  };
}
