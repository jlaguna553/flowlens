import zlib from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT = 0xffff;

function findEndOfCentralDirectory(buf) {
  const lowest = Math.max(0, buf.length - EOCD_MIN_SIZE - EOCD_MAX_COMMENT);
  for (let offset = buf.length - EOCD_MIN_SIZE; offset >= lowest; offset -= 1) {
    if (buf.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

export function unzip(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new Error('zip: end of central directory not found');

  const entryCount = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (buf.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`zip: bad central directory signature at ${cursor}`);
    }

    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLength = buf.readUInt16LE(cursor + 28);
    const extraLength = buf.readUInt16LE(cursor + 30);
    const commentLength = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error(`zip: zip64 entry ${name} is not supported`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue;

    if (buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`zip: bad local header for ${name}`);
    }

    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buf.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`zip: unsupported compression method ${method} for ${name}`);

    files.set(name, data);
  }

  return files;
}
