import { Accessor } from 'solid-js'

export type ValueOf<T extends Record<string, any>> = T[keyof T]

export type ShaderResult = {
  source: string
  bind: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    render: () => void,
    onRender: OnRenderFunction
  ) => void
}

export type PrimitiveOptions = {
  type?: 'attribute' | 'uniform' | 'scope'
  name?: string
}

export type UniformSetter =
  | 'uniform1f'
  | 'uniform1i'
  | 'uniform2fv'
  | 'uniform2iv'
  | 'uniform3fv'
  | 'uniform3iv'
  | 'uniform4fv'
  | 'uniform4iv'

type Buffer = Int8Array | Int16Array | Int32Array | Float32Array | Float64Array
type IntBuffer =
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array

type VariableCallback<
  TType extends string,
  TValue extends any,
  TTOptions = PrimitiveOptions,
> = (
  value: Accessor<TValue>,
  options?: TTOptions
) => {
  dataType: TType
  tokenType: 'uniform' | 'attribute'
  value: Accessor<TValue>
  options: TTOptions
}

export type Sampler2DOptions = PrimitiveOptions & {
  width?: number
  height?: number
  type?: 'float' | 'integer'
  format?: 'RGBA' | 'RGB' | 'LUMINANCE'
  magFilter?: 'NEAREST' | 'LINEAR'
  minFilter?: 'NEAREST' | 'LINEAR'
  border?: number
}

export type Uniform = {
  float: VariableCallback<'float', number>
  int: VariableCallback<'int', number>
  bool: VariableCallback<'bool', boolean>
  vec2: VariableCallback<'vec2', [number, number]>
  ivec2: VariableCallback<'ivec2', [number, number]>
  bvec2: VariableCallback<'bvec2', [boolean, boolean]>
  vec3: VariableCallback<'vec3', [number, number, number]>
  ivec3: VariableCallback<'ivec3', [number, number, number]>
  bvec3: VariableCallback<'bvec3', [boolean, boolean, boolean]>
  vec4: VariableCallback<'vec4', [number, number, number, number]>
  ivec4: VariableCallback<'ivec4', [number, number, number, number]>
  bvec4: VariableCallback<'bvec4', [boolean, boolean, boolean, boolean]>
  sampler2D: VariableCallback<'sampler2D', ArrayBufferView, SamplerZDOptions>
}

export type AttributeOptions = PrimitiveOptions & {
  mode?: 'TRIANGLES' | 'POINTS' | 'LINES'
  target?:
    | 'ARRAY_BUFFER'
    | 'ELEMENT_ARRAY_BUFFER'
    | 'COPY_READ_BUFFER'
    | 'COPY_WRITE_BUFFER'
    | 'TRANSFORM_FEEDBACK_BUFFER'
    | 'UNIFORM_BUFFER'
    | 'PIXEL_PACK_BUFFER'
    | 'PIXEL_UNPACK_BUFFER'
}
export type Attribute = {
  float: VariableCallback<'float', Buffer, AttributeOptions>
  int: VariableCallback<'int', IntBuffer, AttributeOptions>
  bool: VariableCallback<'bool', IntBuffer, AttributeOptions>
  vec2: VariableCallback<'vec2', Buffer, AttributeOptions>
  ivec2: VariableCallback<'ivec2', IntBuffer, AttributeOptions>
  bvec2: VariableCallback<'bvec2', IntBuffer, AttributeOptions>
  vec3: VariableCallback<'vec3', Buffer, AttributeOptions>
  ivec3: VariableCallback<'ivec3', IntBuffer, AttributeOptions>
  bvec3: VariableCallback<'bvec3', IntBuffer, AttributeOptions>
  vec4: VariableCallback<'vec4', Buffer, AttributeOptions>
  ivec4: VariableCallback<'ivec4', IntBuffer, AttributeOptions>
  bvec4: VariableCallback<'bvec4', IntBuffer, AttributeOptions>
}

interface Token {
  name: string
  value: any
  options: PrimitiveOptions
  dataType: keyof Uniform | keyof Attribute
  tokenType: 'attribute' | 'sampler2D' | 'uniform'
}
export interface AttributeToken extends Token {
  options: AttributeOptions
}

export interface UniformToken extends Token {
  functionName: string
}

export interface Sampler2DToken extends Token {
  textureIndex: number
  options: Sampler2DOptions
}

export type ScopedVariableToken = {
  name: string
  tokenType: 'scope'
  options: {
    name: string
  }
}

export type OnRenderFunction = (fn: () => void) => () => void
