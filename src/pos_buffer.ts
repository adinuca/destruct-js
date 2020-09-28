import { DataType, NumericDataType } from '.';

export type DataTypeCtor = new (options?: TypeOptions) => DataType;
export type NumericTypeCtor = new (options?: TypeOptions) => NumericDataType;

export default class PosBuffer {
  private _buffer: Buffer;
  private offsetBytes: number = 0;
  private offsetBits: number = 0;

  constructor(bytes: Buffer | number[], private options: BufferOptions = {}) {
    this._buffer = Buffer.from(bytes);
    this.offsetBytes = options?.offset?.bytes || 0;
    this.offsetBits = options?.offset?.bits || 0;
  }

  public read(dataType: DataTypeCtor, options?: TypeOptions) {
    if (this.offsetBytes > this._buffer.length - 1) {
      throw new Error('Attempt to read outside of the buffer');
    }

    const dataInstruction = new dataType(options);
    const value = dataInstruction.execute(this);
    this.updateOffset(dataInstruction.size);
    return value;
  }

  public readMany(dataTypes: { type: DataTypeCtor, options?: TypeOptions }[]) {
    return dataTypes.map((dt) => {
      return this.read(dt.type, dt.options);
    })
  }

  public skip(bytes: number) {
    this.updateOffset(bytes * 8);
    if (this.offsetBytes > this._buffer.length - 1 || this.offsetBytes < 0) {
      throw new Error('Attempt to skip outside the buffer');
    }
    return this;
  }

  public peek(instruction: new (options?: any) => DataType, byteOffset: number, options?: TypeOptions) {
    const dataInstruction = new instruction(options);
    if (byteOffset < 0 || (byteOffset + this.addOffset(dataInstruction.size).bytes) > this._buffer.length ) {
      throw new Error('Attempt to peek outside of the buffer');
    }

    const originalOffset = this.offset;
    this.offset = { bytes: byteOffset, bits: 0 };
    const value = dataInstruction.execute(this);
    this.offset = originalOffset;
    return value;
  }

  public pad() {
    if (this.offsetBits != 0) {
      this.offsetBytes += 1;
      this.offsetBits = 0;
    }
  }

  public slice(start: number, end?: number) {
    return new PosBuffer(this._buffer.slice(start, end));
  }

  public toString(encoding?: Encoding, start?: number, end?: number) {
    return this._buffer.toString(encoding, start, end);
  }

  get mode() {
    return this.options.endianness || Mode.BE;
  }

  set mode(endianness: Mode) {
    this.options.endianness = endianness;
  }

  get length() {
    return this._buffer.length;
  }

  get buffer() {
    return this._buffer;
  }

  get offset() {
    return {
      bytes: this.offsetBytes,
      bits: this.offsetBits
    }
  }

  set offset(offset: { bytes: number, bits: number}) {
    this.offsetBytes = offset.bytes;
    this.offsetBits = offset.bits;
  }

  private addOffset(bitSize: number): { bytes: number, bits: number} {
    const currentOffsetInBits = (this.offsetBytes * 8) + this.offsetBits;
    const updatedOffsetInBits = currentOffsetInBits + bitSize;

    return { bytes: Math.floor(updatedOffsetInBits / 8), bits: updatedOffsetInBits % 8 };
  }

  private updateOffset(bitSize: number): void {
    const updateOffset = this.addOffset(bitSize);
    this.offsetBytes = updateOffset.bytes;
    this.offsetBits = updateOffset.bits;
  }
}

export type Encoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'binary' | 'hex' | 'latin1';

export interface BufferOptions {
  endianness?: Mode;
  offset?: { bytes: number, bits: number };
}

export interface TypeOptions {
  size?: number;
  encoding?: Encoding;
  terminator?: string | number;
  dp?: number;
}

export enum Mode {
  BE,
  LE
}