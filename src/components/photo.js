import { fabric } from 'fabric';

/**
 * Photo subclass
 * @class fabric.Photo
 * @extends fabric.Photo
 * @return {fabric.Photo} thisArg
 *
 */
fabric.Photo = class extends fabric.Image {
  type = 'photo';
  repeat = 'no-repeat';
  fill = 'transparent';
  initPerspective = true;

  cacheProperties = fabric.Image.prototype.cacheProperties.concat('perspectiveCoords');

  constructor(src, options) {
    super(options);

    if (options) this.setOptions(options);

    this.on('added', () => {
      const image = new Image();
      image.setAttribute('crossorigin', 'anonymous');
      image.onload = () => {
        this._initElement(image, options);
        this.width = image.width / fabric.devicePixelRatio;
        this.height = image.height / fabric.devicePixelRatio;
        this.loaded = true;
        this.setCoords();
        this.fire('image:loaded');
      };
      image.src = src;

      this.on('image:loaded', () => {
        !this.perspectiveCoords && this.getInitialPerspective();

        this.togglePerspective();
        this.canvas.requestRenderAll();
      });
    });
  }

  cacheProperties = fabric.Image.prototype.cacheProperties.concat('perspectiveCoords');

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx Context to render on
   *//** @ts-ignore */
  _render(ctx) {
    fabric.util.setImageSmoothing(ctx, this.imageSmoothing);

    if (this.isMoving !== true && this.resizeFilter && this._needsResize()) {
      this.applyResizeFilters();
    }

    this._stroke(ctx);
    this._renderPaintInOrder(ctx);
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx Context to render on
   *//** @ts-ignore */
  _renderFill(ctx) {
    var elementToDraw = this._element;
    if (!elementToDraw) return;

    ctx.save();
    const elWidth = elementToDraw.naturalWidth || elementToDraw.width;
    const elHeight = elementToDraw.naturalHeight || elementToDraw.height;
    const width = this.width;
    const height = this.height;

    ctx.translate(-width / 2, -height / 2);

    // get the scale
    const scale = Math.min(width / elWidth, height / elHeight);
    // get the top left position of the image
    const x = (width / 2) - (elWidth / 2) * scale;
    const y = (height / 2) - (elHeight / 2) * scale;

    ctx.drawImage(elementToDraw, x, y, elWidth * scale, elHeight * scale);

    ctx.restore();
  }

  togglePerspective(mode = true) {
    this.set('perspectiveMode', mode);
    // this.set('hasBorders', !mode);

    if (mode === true) {
      this.set('layout', 'fit');

      var lastControl = this.perspectiveCoords.length - 1;

      this.controls = this.perspectiveCoords.reduce((acc, coord, index) => {
        const anchorIndex = index > 0 ? index - 1 : lastControl;
        let name = `prs${index + 1}`;

        acc[name] = new fabric.Control({
          name,
          x: -0.5,
          y: -0.5,
          actionHandler: this._actionWrapper(anchorIndex, (_, transform, x, y) => {
            const target = transform.target;
            const localPoint = target.toLocalPoint(new fabric.Point(x, y), 'left', 'top');

            coord[0] = localPoint.x / target.scaleX * fabric.devicePixelRatio;
            coord[1] = localPoint.y / target.scaleY * fabric.devicePixelRatio;

            target.setCoords();
            target.applyFilters();

            return true;
          }),
          positionHandler: function (dim, finalMatrix, fabricObject) {
            const zoom = fabricObject.canvas.getZoom();
            const scalarX = fabricObject.scaleX * zoom / fabric.devicePixelRatio;
            const scalarY = fabricObject.scaleY * zoom / fabric.devicePixelRatio;

            var point = fabric.util.transformPoint({
              x: this.x * dim.x + this.offsetX + coord[0] * scalarX,
              y: this.y * dim.y + this.offsetY + coord[1] * scalarY,
            }, finalMatrix
            );

            return point;
          },
          cursorStyleHandler: () => 'cell',
          render: function (ctx, left, top, _, fabricObject) {
            const zoom = fabricObject.canvas.getZoom();
            const scalarX = fabricObject.scaleX * zoom / fabric.devicePixelRatio;
            const scalarY = fabricObject.scaleY * zoom / fabric.devicePixelRatio;

            ctx.save();
            ctx.translate(left, top);
            ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
            ctx.beginPath();

            ctx.moveTo(0, 0);
            ctx.strokeStyle = 'green';

            if (fabricObject.perspectiveCoords[index + 1]) {
              ctx.strokeStyle = 'green';
              ctx.lineTo(
                (fabricObject.perspectiveCoords[index + 1][0] - coord[0]) * scalarX,
                (fabricObject.perspectiveCoords[index + 1][1] - coord[1]) * scalarY,
              );
            } else {
              ctx.lineTo(
                (fabricObject.perspectiveCoords[0][0] - coord[0]) * scalarX,
                (fabricObject.perspectiveCoords[0][1] - coord[1]) * scalarY,
              );
            }
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = 'green';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          },
          offsetX: 0,
          offsetY: 0,
          actionName: 'perspective-coords',
        });

        return acc;
      }, {});
    } else {
      this.controls = fabric.Photo.prototype.controls;
    }

    this.canvas.requestRenderAll();
  }

  _actionWrapper(anchorIndex, fn) {
    return function (eventData, transform, x, y) {
      if (!transform || !eventData) return;

      const { target } = transform;

      target._resetSizeAndPosition(anchorIndex);

      const actionPerformed = fn(eventData, transform, x, y);
      return actionPerformed;
    };
  }

  /**
   * @description manually reset the bounding box after points update
   *
   * @see http://fabricjs.com/custom-controls-polygon
   * @param {number} index
   */
  _resetSizeAndPosition = (index, apply = true) => {
    const absolutePoint = fabric.util.transformPoint({
      x: this.perspectiveCoords[index][0],
      y: this.perspectiveCoords[index][1],
    }, this.calcTransformMatrix());

    this._setPositionDimensions({});

    const penBaseSize = this._getNonTransformedDimensions();
    const newX = (this.perspectiveCoords[index][0]) / penBaseSize.x;
    const newY = (this.perspectiveCoords[index][1]) / penBaseSize.y;

    this.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);

    apply && this._applyPointsOffset();
  }

  /**
   * This is modified version of the internal fabric function
   * this helps determine the size and the location of the path
   *
   * @param {object} options
   */
  _setPositionDimensions(options) {
    const { left, top, width, height } = this._calcDimensions(options);

    this.width = width;
    this.height = height;

    var correctLeftTop = this.translateToGivenOrigin(
      {
        x: left,
        y: top,
      },
      'left',
      'top',
      this.originX,
      this.originY
    );

    if (typeof options.left === 'undefined') {
      this.left = correctLeftTop.x;
    }
    if (typeof options.top === 'undefined') {
      this.top = correctLeftTop.y;
    }

    this.pathOffset = {
      x: left,
      y: top,
    };

    return { left, top, width, height };
  }

  /**
   * @description this is based on fabric.Path._calcDimensions
   *
   * @private
   */
  _calcDimensions() {
    const coords = this.perspectiveCoords.slice().map(c => (
      {
        x: c[0] / fabric.devicePixelRatio,
        y: c[1] / fabric.devicePixelRatio,
      }
    ));

    const minX = fabric.util.array.min(coords, 'x') || 0;
    const minY = fabric.util.array.min(coords, 'y') || 0;
    const maxX = fabric.util.array.max(coords, 'x') || 0;
    const maxY = fabric.util.array.max(coords, 'y') || 0;

    const width = Math.abs(maxX - minX);
    const height = Math.abs(maxY - minY);

    return {
      left: minX,
      top: minY,
      width: width,
      height: height,
    };
  }

  /**
   * @description This is modified version of the internal fabric function
   * this subtracts the path offset from each path points
   */
  _applyPointsOffset() {
    for (let i = 0; i < this.perspectiveCoords.length; i++) {
      const coord = this.perspectiveCoords[i];

      coord[0] -= this.pathOffset.x;
      coord[1] -= this.pathOffset.y;
    }
  }

  /**
   * @description generate the initial coordinates for warping, based on image dimensions
   *
   */
  getInitialPerspective() {
    let w = this.getScaledWidth();
    let h = this.getScaledHeight();

    const perspectiveCoords = [
      [0, 0], // top left
      [w, 0], // top right
      [w, h], // bottom right
      [0, h], // bottom left
    ];

    this.perspectiveCoords = perspectiveCoords;

    const perspectiveFilter = new fabric.Image.filters.Perspective({
      hasRelativeCoordinates: false,
      pixelRatio: fabric.devicePixelRatio, // the Photo is already retina ready
      perspectiveCoords
    });

    this.filters.push(perspectiveFilter);
    this.applyFilters();

    return perspectiveCoords;
  }
};

/**
 * Creates an instance of fabric.Photo from its object representation
 * @static
 * @param {Object} object Object to create an instance from
 * @param {Function} callback Callback to invoke when an image instance is created
 */
fabric.Photo.fromObject = function (_object, callback) {
  const object = fabric.util.object.clone(_object);
  object.layout = _object.layout;

  fabric.util.loadImage(object.src, function (img, isError) {
    if (isError) {
      callback && callback(null, true);

      return;
    }
    fabric.Photo.prototype._initFilters.call(object, object.filters, function (filters) {
      object.filters = filters || [];
      fabric.Photo.prototype._initFilters.call(object, [object.resizeFilter], function (resizeFilters) {
        object.resizeFilter = resizeFilters[0];

        fabric.util.enlivenObjects([object.clipPath], function (enlivedProps) {
          object.clipPath = enlivedProps[0];
          var image = new fabric.Photo(img, object);

          callback(image, false);
        });
      });
    });
  }, null, object.crossOrigin || 'anonymous');
};
