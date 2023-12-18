import {
  JSXElement,
  Setter,
  children,
  createContext,
  createEffect,
  createMemo,
  mergeProps,
  onMount,
  splitProps,
  useContext,
  type Accessor,
  type ComponentProps,
} from 'solid-js'

import { CreateProgramConfig } from '@core/hooks'
import type { RenderMode, ShaderToken } from '@core/types'
import { GLProgram, GLStack, filterGLPrograms } from '.'

/* CONTEXT */

const internalContext = createContext<{
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  onProgramCreate?: () => void
  events: {
    onResize: Set<() => void>
    onRender: Set<() => void>
  }
}>()
const useInternal = () => useContext(internalContext)

const signalGLContext = createContext<{
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  onRender: (callback: () => void) => () => void
  onResize: (callback: () => void) => () => void
}>()
export const useSignalGL = () => useContext(signalGLContext)

/* UTILS */

const createRenderLoop = (
  config: StackProps & {
    stack: GLStack
  }
) => {
  const context = useInternal()

  if (!context) return

  config.stack.autosize(() => {
    config.onResize?.(config.stack)
    context.events.onResize.forEach((fn) => fn())
  })

  const render = () => {
    if (config.clear) {
      if (typeof config.clear === 'function') config.clear(config.stack)
      else config.stack.clear()
    }
    config.onRender?.()
    context.events.onRender.forEach((fn) => fn())
    config.stack.render()
  }

  const animate = () => {
    if (config.animate) requestAnimationFrame(animate)
    render()
  }
  createEffect(() => {
    if (config.animate) animate()
    else createEffect(render)
  })
}

/* PROGRAM */

interface ProgramPropsBase {
  fragment: Accessor<ShaderToken>
  onRender?: (gl: WebGL2RenderingContext, program: WebGLProgram) => void
  ref?: Setter<HTMLCanvasElement>
  vertex: Accessor<ShaderToken>
  buffer?: any
  /**
   * default "TRIANGLES"
   */
  mode?: RenderMode
  /**
   * @unstable
   * ⚠️ Caching can cause issues when used in combination with dynamic and/or conditional glsl-snippets. Only enable cache when generated source is static. ⚠️
   */
  cacheEnabled?: boolean
}

/* Program rendered with gl.drawElements */
interface ArrayProgramProps extends ProgramPropsBase {
  count: number
}

/* Program rendered with gl.drawArray */
interface ElementProgramProps extends ProgramPropsBase {
  indices: number[] | Uint16Array
}

type ProgramProps = ArrayProgramProps | ElementProgramProps

export const Program = (props: ProgramProps) => {
  const context = useInternal()
  if (!context) throw 'no context'
  const [shader, rest] = splitProps(props, ['vertex', 'fragment'])
  const config = mergeProps(
    {
      canvas: context.canvas,
      get fragment() {
        return shader.fragment()
      },
      get vertex() {
        return shader.vertex()
      },
      mode: 'TRIANGLES',
    },
    rest
  )
  return createMemo(
    () => new GLProgram(config as CreateProgramConfig)
  ) as any as JSXElement // cast to JSX
}

type StackProps = ComponentProps<'canvas'> & {
  onRender?: () => void
  onResize?: (token: GLStack) => void
  onProgramCreate?: () => void
  /* Enable/disable clear-function or provide a custom one. */
  clear?: boolean | ((gl: GLStack) => void)
  /* Enable/disable `rAF`-based animation or request fps. If disabled, render-loop will be `effect`-based. */
  animate?: boolean | number
}
export const Stack = (props: StackProps) => {
  const [childrenProps, rest] = splitProps(props, ['children'])
  const canvas = (<canvas {...rest} />) as HTMLCanvasElement
  const gl = canvas.getContext('webgl2')!

  const events = {
    onResize: new Set<() => void>(),
    onRender: new Set<() => void>(),
  }

  return (
    <internalContext.Provider
      value={{
        canvas,
        gl,
        get onProgramCreate() {
          return props.onProgramCreate
        },
        events,
      }}
    >
      <signalGLContext.Provider
        value={{
          canvas,
          gl,
          onResize: (callback: () => void) => {
            events.onResize.add(callback)
            return () => events.onResize.delete(callback)
          },
          onRender: (callback: () => void) => {
            events.onRender.add(callback)
            return () => events.onRender.delete(callback)
          },
        }}
      >
        {(() => {
          const childs = children(() => childrenProps.children)
          onMount(() => {
            try {
              const stack = new GLStack({
                canvas,
                get programs() {
                  return filterGLPrograms(childs())
                },
              })
              createRenderLoop(mergeProps(props, { stack }))
            } catch (error) {
              console.error(error)
            }
          })

          return canvas
        })()}
      </signalGLContext.Provider>
    </internalContext.Provider>
  )
}
