import { Accessor, mergeProps } from 'solid-js'

import { createWebGLProgram } from './compilation'
import { attribute, glsl, uniform } from './template'
import type {
  Buffer,
  DataType,
  Format,
  InternalFormat,
  ShaderToken,
  UniformProxy,
} from './types'
import { getTextureConfigFromTypedArray, objectsAreEqual } from './utils'

/* 
  CREATE_STACK-HOOK 
*/
type StackConfig = {
  canvas: HTMLCanvasElement
  programs: ReturnType<typeof createProgram>[]
  extensions?: {
    /** default true */
    float?: boolean
    /** default false */
    half_float?: boolean
  }
}
export type StackToken = StackConfig & {
  ctx: WebGL2RenderingContext
  render: () => void
}
/**
 * Returns `ComposerToken`.
 * @param config `ComposerConfig`
 * @returns `ComposerToken`
 */
export const createStack = (config: StackConfig): StackToken => {
  const ctx = config.canvas.getContext('webgl2')!
  if (!ctx) throw 'webgl2 is not supported'

  // TODO: should these extensions be effectful?
  // default value = true
  if (config?.extensions?.float !== false) {
    ctx.getExtension('EXT_color_buffer_float')
  }
  // default value = false
  if (config?.extensions?.half_float) {
    ctx.getExtension('EXT_color_buffer_half_float')
  }

  return {
    ...config,
    ctx,
    render: () => config.programs.forEach((program) => program.render()),
  }
}

/* 
  CREATE_PROGRAM-HOOK
*/

const IS_PROGRAM = Symbol('is-program')
type CreateProgramConfig = {
  canvas: HTMLCanvasElement
  cacheEnabled?: boolean
  count: number
  first?: number
  fragment: ShaderToken
  mode: 'TRIANGLES' | 'LINES' | 'POINTS'
  vertex: ShaderToken
  onRender?: (gl: WebGL2RenderingContext, program: WebGLProgram) => void
}
export type ProgramToken = CreateProgramConfig & {
  program: WebGLProgram
  ctx: WebGL2RenderingContext
  render: () => void
  [IS_PROGRAM]: true
}
/**
 * Returns `ProgramToken`. Manages `WebGLProgram` of given vertex- and fragment- `glsl` shaders.
 * @param config
 * @returns
 */
export const createProgram = (config: CreateProgramConfig): ProgramToken => {
  const ctx = config.canvas.getContext('webgl2')

  if (!ctx) throw 'webgl2 is not supported'

  /* create program */
  const cachedProgram = config.cacheEnabled && getProgramCache(config)
  const program =
    cachedProgram ||
    createWebGLProgram(
      ctx,
      config.vertex.source.code,
      config.fragment.source.code
    )
  if (!program) throw `error while building program`
  if (config.cacheEnabled) setProgramCache({ ...config, program })

  /* Map of all uniforms/attributes in this program. Gets added to during bind-stage with `addToQueue`. */
  const updateQueue: Map<WebGLUniformLocation | number, () => void> = new Map()
  const addToUpdateQueue = (
    location: WebGLUniformLocation | number,
    fn: () => void
  ) => (updateQueue.set(location, fn), () => updateQueue.delete(location))

  /* render-function */
  const render = () => {
    ctx.useProgram(program)
    /* iterate through all uniforms/attributes and update them. */
    updateQueue.forEach((update) => update())
    config.onRender?.(ctx, program)
    ctx.drawArrays(ctx[config.mode], config.first || 0, config.count)
  }

  /* bind all uniforms/attributes to the program and add to `updateQueue` */
  config.vertex.bind(ctx, program, addToUpdateQueue, render)
  config.fragment.bind(ctx, program, addToUpdateQueue, render)

  return {
    ...config,
    program,
    ctx,
    render,
    [IS_PROGRAM]: true,
  }
}

/* Manages program-cache of `createProgram` */
const programCache: WeakMap<
  TemplateStringsArray,
  WeakMap<TemplateStringsArray, WebGLProgram>
> = new WeakMap()
const getProgramCache = (config: {
  vertex: ShaderToken
  fragment: ShaderToken
}) => programCache.get(config.vertex.template)?.get(config.fragment.template)
const setProgramCache = ({
  vertex,
  fragment,
  program,
}: {
  vertex: ShaderToken
  fragment: ShaderToken
  program: WebGLProgram
}) => {
  if (!programCache.get(vertex.template)) {
    programCache.set(vertex.template, new WeakMap())
  }
  if (!programCache.get(vertex.template)!.get(fragment.template)) {
    programCache.get(vertex.template)!.set(fragment.template, program)
  }
}

/** Checks if a given value is a `ProgramToken` */
export const isProgramToken = (value: any): value is ProgramToken =>
  typeof value === 'object' && IS_PROGRAM in value

/** Filters `any` for `ProgramTokens`. Returns `ProgramToken[]` */
export const filterProgramTokens = (value: any) =>
  (typeof value === 'object' && Array.isArray(value)
    ? (value as any[])
    : [value]
  ).filter(isProgramToken)

/* 
  UTILITY-FUNCTIONS FOR GL_TOKEN AND PROGRAM_TOKEN
*/

/**
 * Utility-function to automatically update `GLToken['canvas'] | ProgramToken['canvas']` width/height on resize.
 * @param gl
 * @returns void
 */
export const autosize = ({
  canvas,
  ctx,
  render,
}: StackToken | ProgramToken) => {
  /* Observe resize-events canvas */
  const resizeObserver = new ResizeObserver(() => {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    ctx.viewport(0, 0, canvas.width, canvas.height)
    render()
  })
  resizeObserver.observe(canvas)
}

/**
 * Utility-function to clear canvas with sensible defaults.
 * @param `GLToken | ProgramToken`
 * @returns void
 */
export const clear = ({ ctx }: StackToken | ProgramToken) => {
  ctx.clearColor(0.0, 0.0, 0.0, 1.0)
  ctx.clearDepth(1.0)
  ctx.enable(ctx.DEPTH_TEST)
  ctx.depthFunc(ctx.LEQUAL)
  ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)
}

type RenderBufferConfig = {
  internalFormat: InternalFormat
  width: number
  height: number
}
/**
 * Utility-function to set renderBuffer of a `GLToken['context'] | ProgramToken['context']`.
 * @param gl
 * @param {RenderBufferConfig} config
 * @returns `typeof config.output`
 */
export const renderBuffer = (
  { ctx }: StackToken | ProgramToken,
  { internalFormat, width, height }: RenderBufferConfig
) => {
  const framebuffer = ctx.createFramebuffer()
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer)

  /* Create a renderbuffer */
  const renderBuffer = ctx.createRenderbuffer()
  ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderBuffer)
  ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx[internalFormat], width, height)

  /* Attach the renderbuffer to the framebuffer */
  ctx.framebufferRenderbuffer(
    ctx.FRAMEBUFFER,
    ctx.COLOR_ATTACHMENT0,
    ctx.RENDERBUFFER,
    renderBuffer
  )

  ctx.finish()
}

const readCache = new WeakMap<WebGL2RenderingContext, Record<string, any>>()
type ReadConfig = {
  width?: number
  height?: number
  internalFormat?: InternalFormat
  format?: Format
  dataType?: DataType
  output: Buffer
}
/**
 * Utility-function to read the pixel-data of a `GLToken['context']`.
 * @param token
 * @param {ReadConfig} config
 * @returns `typeof config.output`
 */
export const read = (token: StackToken | ProgramToken, config?: ReadConfig) => {
  const mergedConfig = mergeProps(
    {
      format: 'RGBA',
      dataType: 'UNSIGNED_BYTE',
      internalFormat: 'RGBA8',
      width: token.canvas.width,
      height: token.canvas.height,
    } as const,
    config
  )

  if (
    !readCache.get(token.ctx) ||
    !objectsAreEqual(mergedConfig, readCache.get(token.ctx))
  ) {
    readCache.set(token.ctx, mergedConfig)
    renderBuffer(token, mergedConfig)
  }

  clear(token)
  token.render()

  token.ctx.readPixels(
    0,
    0,
    mergedConfig.width,
    mergedConfig.height,
    token.ctx[mergedConfig.format],
    token.ctx[mergedConfig.dataType],
    mergedConfig.output
  )

  return mergedConfig.output
}

/* 
  CREATE_COMPUTATION-HOOK 
*/

const computationCanvas = document.createElement('canvas')
type ComputationConfig = {
  /** _Uint8Array_ `UNSIGNED_BYTE` _Float32Array_ `FLOAT` _default_ `FLOAT` */
  dataType?: DataType
  /** _default_ input.length */
  width?: number
  /** _default_ 1 */
  height?: number
  /**  _Uint8Array_ `R8` _Float32Array_ `R32F` _default_ `R32F` */
  internalFormat?: InternalFormat
  /** _Uint8Array_ `RED` _Float32Array_ `RED` _default_ `RED` */
  format?: Format
}
/**
 * currently fully supported: `Uint8Array` and `Float32Array`
 * @param input _required_ () => Buffer
 * @param callback _required_ glsl-lambda: expects a `vec2` to be returned
 * @param config _optional_
 * @param config.width _default_ input.length
 * @param config.height _default_ 1
 * @param config.dataType _Uint8Array_ `UNSIGNED_BYTE` _Float32Array_ `FLOAT` _default_ `FLOAT`
 * @param config.format _Uint8Array_ `RED` _Float32Array_ `RED` _default_ `RED`
 * @param config.internalFormat _Uint8Array_ `R8` _Float32Array_ `R32F` _default_ `R32F`
 * @returns TBuffer
 */
export const createComputation = function <TBuffer extends Buffer>(
  input: Accessor<TBuffer>,
  callback: (
    uniform: ReturnType<UniformProxy['sampler2D']>
  ) => Accessor<ShaderToken>,
  config?: ComputationConfig
) {
  let output: TBuffer
  let bufferType = input().constructor as {
    new (length: number): TBuffer
  }

  const getConfig = () =>
    mergeProps(
      {
        internalFormat: 'R32F',
        format: 'RED',
        width: input().length,
        height: 1,
        dataType: 'FLOAT',
        output,
      },
      getTextureConfigFromTypedArray(input()),
      config
    )

  const a_vertices = attribute.vec2(
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  )
  const vertex = glsl`#version 300 es
void main(){gl_Position = vec4(${a_vertices}, 0.0, 1.0);}`

  const fragment = glsl`#version 300 es
precision highp float; out vec4 outColor; vec4 compute(){${callback(
    uniform.sampler2D(input, getConfig())
  )}} void main(){outColor = compute();}`

  const program = createProgram({
    canvas: computationCanvas,
    vertex: vertex(),
    fragment: fragment(),
    mode: 'TRIANGLES',
    count: 4,
  })

  const updateOutput = () => {
    if (input().constructor !== output?.constructor) {
      bufferType = input().constructor as {
        new (length: number): TBuffer
      }
      output = new bufferType(input().length)
    } else if (input().length !== output?.length) {
      output = new bufferType(input().length)
    }
  }

  updateOutput()

  return () => {
    updateOutput()
    clear(program)
    program.render()
    return read(program, getConfig())
  }
}
