import { createReadStream, createWriteStream } from 'fs';
import { createBrotliCompress, createGzip } from 'zlib';
import { pipeline } from 'stream';

function CompressionFile(suffix = 'br', fileName = 'pngtiny-custom.wasm', mode = createBrotliCompress()) {
  return new Promise(function (resolve, reject) {
    const source = createReadStream(`./public/${fileName}`);
    const destination = createWriteStream(`./dist/${fileName}.${ suffix }`);
    pipeline(source, mode, destination, (err) => {
      if (err) {
        console.error('An error occurred:', err);
        reject(err);
      } else resolve(err);
    });
  });
}
/** 压缩一个br */
CompressionFile();

/** 压缩一个gz */
CompressionFile('gz', void 0, createGzip());
