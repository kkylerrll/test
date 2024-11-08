import { fabric } from 'fabric';
import flatten from 'lodash.flatten';
import verb from "verb-nurbs-web";

fabric.Image.filters.Perspective = class extends fabric.Image.filters.BaseFilter {
  /**
   * Constructor
   * @param {Object} [options] Options object
   */
  constructor(options) {
    super();

    if (options) this.setOptions(options);

    this.applyPixelRatio();
  }

  type = 'Perspective';
  pixelRatio = fabric.devicePixelRatio;
  bounds = { width: 0, height: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  hasRelativeCoordinates = true;

  /**
   * Array of attributes to send with buffers. do not modify
   * @private
   *//** @ts-ignore */
  vertexSource = `
        precision mediump float;

        attribute vec2 aPosition;
        attribute vec2 aUvs;

        uniform float uStepW;
        uniform float uStepH;

        varying vec2 vUvs;

        vec2 uResolution;

        void main() {
            vUvs = aUvs;
            uResolution = vec2(uStepW, uStepH);

            gl_Position = vec4(uResolution * aPosition * 2.0 - 1.0, 0.0, 1.0);
        }
    `;

  fragmentSource = `
        precision mediump float;
        varying vec2 vUvs;
        uniform sampler2D uSampler;

        void main() {
            gl_FragColor = texture2D(uSampler, vUvs);
        }
    `;

  /**
   * Return a map of attribute names to WebGLAttributeLocation objects.
   *
   * @param {WebGLRenderingContext} gl The canvas context used to compile the shader program.
   * @param {WebGLShaderProgram} program The shader program from which to take attribute locations.
   * @returns {Object} A map of attribute names to attribute locations.
   */
  getAttributeLocations(gl, program) {
    return {
      aPosition: gl.getAttribLocation(program, 'aPosition'),
      aUvs: gl.getAttribLocation(program, 'aUvs'),
    };
  }

  /**
   * Send attribute data from this filter to its shader program on the GPU.
   *
   * @param {WebGLRenderingContext} gl The canvas context used to compile the shader program.
   * @param {Object} attributeLocations A map of shader attribute names to their locations.
   */
  sendAttributeData(gl, attributeLocations, data, type = 'aPosition') {
    const attributeLocation = attributeLocations[type];
    if (gl[type + 'vertexBuffer'] == null) {
      gl[type + 'vertexBuffer'] = gl.createBuffer();
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl[type + 'vertexBuffer']);
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  generateSurface() {
    const corners = this.perspectiveCoords;

    const surface = verb.geom.NurbsSurface.byCorners(...corners);
    const tess = surface.tessellate();

    return tess;
  }

  /**
   * Apply the resize filter to the image
   * Determines whether to use WebGL or Canvas2D based on the options.webgl flag.
   *
   * @param {Object} options
   * @param {Number} options.passes The number of filters remaining to be executed
   * @param {Boolean} options.webgl Whether to use webgl to render the filter.
   * @param {WebGLTexture} options.sourceTexture The texture setup as the source to be filtered.
   * @param {WebGLTexture} options.targetTexture The texture where filtered output should be drawn.
   * @param {WebGLRenderingContext} options.context The GL context used for rendering.
   * @param {Object} options.programCache A map of compiled shader programs, keyed by filter type.
   */
  applyTo(options) {
    if (options.webgl) {
      const { width, height } = this.getPerspectiveBounds();
      options.context.canvas.width = width;
      options.context.canvas.height = height;

      options.destinationWidth = width;
      options.destinationHeight = height;

      this.hasRelativeCoordinates && this.calculateCoordsByCorners();

      this._setupFrameBuffer(options);
      this.applyToWebGL(options);
      this._swapTextures(options);
    }
  }

  applyPixelRatio(coords = this.perspectiveCoords) {
    for (let i = 0; i < coords.length; i++) {
      coords[i][0] *= this.pixelRatio;
      coords[i][1] *= this.pixelRatio;
    }

    return coords;
  }

  getPerspectiveBounds(coords = this.perspectiveCoords) {
    coords = this.perspectiveCoords.slice().map(c => (
      {
        x: c[0],
        y: c[1],
      }
    ));

    this.bounds.minX = fabric.util.array.min(coords, 'x') || 0;
    this.bounds.minY = fabric.util.array.min(coords, 'y') || 0;
    this.bounds.maxX = fabric.util.array.max(coords, 'x') || 0;
    this.bounds.maxY = fabric.util.array.max(coords, 'y') || 0;

    this.bounds.width = Math.abs(this.bounds.maxX - this.bounds.minX);
    this.bounds.height = Math.abs(this.bounds.maxY - this.bounds.minY);

    return {
      width: this.bounds.width,
      height: this.bounds.height,
      minX: this.bounds.minX,
      maxX: this.bounds.maxX,
      minY: this.bounds.minY,
      maxY: this.bounds.maxY,
    };
  }

  /**
   * @description coordinates are coming in relative to mockup item sections
   * the following function normalizes the coords based on canvas corners
   *
   * @param {number[]} coords
   */
  calculateCoordsByCorners(coords = this.perspectiveCoords) {
    for (let i = 0; i < coords.length; i++) {
      coords[i][0] -= this.bounds.minX;
      coords[i][1] -= this.bounds.minY;
    }
  }

  /**
   * Apply this filter using webgl.
   *
   * @param {Object} options
   * @param {Number} options.passes The number of filters remaining to be executed
   * @param {Boolean} options.webgl Whether to use webgl to render the filter.
   * @param {WebGLTexture} options.originalTexture The texture of the original input image.
   * @param {WebGLTexture} options.sourceTexture The texture setup as the source to be filtered.
   * @param {WebGLTexture} options.targetTexture The texture where filtered output should be drawn.
   * @param {WebGLRenderingContext} options.context The GL context used for rendering.
   * @param {Object} options.programCache A map of compiled shader programs, keyed by filter type.
   */
  applyToWebGL(options) {
    const gl = options.context;
    const shader = this.retrieveShader(options);
    const tess = this.generateSurface(options.sourceWidth, options.sourceHeight);
    const indices = new Uint16Array(flatten(tess.faces));

    // Clear the canvas first
    this.clear(gl); // !important

    // bind texture buffer
    this.bindTexture(gl, options);

    gl.useProgram(shader.program);

    // create the buffer
    this.indexBuffer(gl, indices);

    this.sendAttributeData(gl, shader.attributeLocations, new Float32Array(flatten(tess.points)), 'aPosition');
    this.sendAttributeData(gl, shader.attributeLocations, new Float32Array(flatten(tess.uvs)), 'aUvs');

    gl.uniform1f(shader.uniformLocations.uStepW, 1 / gl.canvas.width);
    gl.uniform1f(shader.uniformLocations.uStepH, 1 / gl.canvas.height);

    this.sendUniformData(gl, shader.uniformLocations);
    gl.viewport(0, 0, options.destinationWidth, options.destinationHeight);

    // enable indices up to 4294967296 for webGL 1.0
    gl.getExtension('OES_element_index_uint');
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  clear(gl) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  bindTexture(gl, options) {
    if (options.pass === 0 && options.originalTexture) {
      gl.bindTexture(gl.TEXTURE_2D, options.originalTexture);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, options.sourceTexture);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  indexBuffer(gl, data) {
    const indexBuffer = gl.createBuffer();
    // make this buffer the current 'ELEMENT_ARRAY_BUFFER'
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    // Fill the current element array buffer with data
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
};

/**
 * Returns filter instance from an object representation
 * @static
 * @param {Object} object Object to create an instance from
 * @param {function} [callback] to be invoked after filter creation
 * @return {fabric.Image.filters.Perspective} Instance of fabric.Image.filters.Perspective
 */
fabric.Image.filters.Perspective.fromObject = fabric.Image.filters.BaseFilter.fromObject;
