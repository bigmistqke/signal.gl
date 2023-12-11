import { Program, Stack } from '@bigmistqke/signal-gl'
import { attribute, glsl, uniform } from '@core/template'
import { mat4 } from 'gl-matrix'
import { createEffect, createSignal, untrack } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'

function App() {
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>(null!)

  const [projectionMatrix, setProjectionMatrix] = createSignal<mat4>(
    mat4.create()
  )
  const [modelViewMatrix, setModelViewMatrix] = createSignal<mat4>(
    mat4.create()
  )

  const render = () => {
    const _projectionMatrix = mat4.create()
    const _modelViewMatrix = mat4.create()

    mat4.perspective(
      _projectionMatrix,
      (45 * Math.PI) / 180,
      canvas().clientWidth / canvas().clientHeight,
      0.1,
      100.0
    )

    mat4.translate(_modelViewMatrix, _modelViewMatrix, [0.0, 0.0, -6.0])
    mat4.rotate(
      _modelViewMatrix,
      _modelViewMatrix,
      performance.now() / 1000,
      [1, 1, 1]
    )
    setProjectionMatrix(_projectionMatrix)
    setModelViewMatrix(_modelViewMatrix)

    requestAnimationFrame(render)
  }

  createEffect(() => {
    if (!canvas()) return
    console.log('canvas', canvas())
    untrack(render)
  })

  const u_projectionMatrix = uniform.mat4(projectionMatrix)
  const u_modelViewMatrix = uniform.mat4(modelViewMatrix)

  const a_positions = attribute.vec3(
    // prettier-ignore
    new Float32Array([
      // Front face
      -1, -1,  1, 
       1, -1,  1, 
       1,  1,  1,
      -1,  1,  1,

      // Back face
      -1, -1, -1, 
      -1,  1, -1, 
       1,  1, -1, 
       1, -1, -1,

      // Top face
      -1,  1, -1, 
      -1,  1,  1, 
       1,  1,  1, 
       1,  1, -1,

      // Bottom face
      -1, -1, -1, 
       1, -1, -1, 
       1, -1,  1,
      -1, -1,  1,

      // Right face
      1, -1, -1, 
      1,  1, -1, 
      1,  1,  1, 
      1, -1,  1,

      // Left face
      -1, -1, -1, 
      -1, -1,  1, 
      -1,  1,  1, 
      -1,  1, -1,
    ])
  )

  const a_indices = attribute.int(
    // prettier-ignore
    new Uint16Array([
      // Front face
       0,  1,   2,  0,  2,  3, 
      // Back face
       4,  5,   6,  4,  6,  7, 
      // Top face
       8,  9,  10,  8, 10, 11, 
      // Bottom face
      12, 13,  14, 12, 14, 15, 
      // Right face
      16, 17,  18, 16, 18, 19, 
      // Left face
      20, 21,  22, 20, 22, 23, 
    ]),
    { target: 'ELEMENT_ARRAY_BUFFER' }
  )

  // Vertex shader program
  const vsSource = glsl`#version 300 es
void main(void) {
    gl_Position = ${u_projectionMatrix} * ${u_modelViewMatrix} * vec4(${a_positions}, 1.);
}
`

  // Fragment shader program
  const fsSource = glsl`#version 300 es
precision mediump float;
out vec4 color;
void main(void) {
  color = vec4(1.0,0.0,0.0,1.0);
}
`

  const indices = [
    // Front face
    0, 1, 2, 0, 2, 3,
    // Back face
    4, 5, 6, 4, 6, 7,
    // Top face
    8, 9, 10, 8, 10, 11,
    // Bottom face
    12, 13, 14, 12, 14, 15,
    // Right face
    16, 17, 18, 16, 18, 19,
    // Left face
    20, 21, 22, 20, 22, 23,
  ]

  return (
    <Stack ref={setCanvas}>
      <Program
        ref={setCanvas}
        vertex={vsSource}
        fragment={fsSource}
        mode="TRIANGLES"
        indices={indices}
        count={36}
      />
    </Stack>
  )
}

render(() => <App />, document.getElementById('app')!)
