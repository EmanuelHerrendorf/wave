import {Interpolation, Unit, UnitDict} from '../../operators/unit.model';
import {Color, RgbaLike, RgbaTuple, TRANSPARENT, WHITE} from '../../colors/color';
import {ColorizerData, IColorizerData, MappingRasterColorizerDict} from '../../colors/colorizer-data.model';
import {ColorBreakpoint, ColorBreakpointDict} from '../../colors/color-breakpoint.model';

export enum SymbologyType {
    RASTER,
    SIMPLE_POINT,
    CLUSTERED_POINT,
    SIMPLE_VECTOR,
    MAPPING_COLORIZER_RASTER,
    ICON_POINT, // RESERVED
    COMPLEX_POINT,
    COMPLEX_VECTOR,
}

export const DEFAULT_VECTOR_STROKE_COLOR: Color = Color.fromRgbaLike([0, 0, 0, 1]);
export const DEFAULT_VECTOR_FILL_COLOR: Color = Color.fromRgbaLike([255, 0, 0, 1]);
export const DEFAULT_VECTOR_HIGHLIGHT_STROKE_COLOR: Color = Color.fromRgbaLike([255, 255, 255, 1]);
export const DEFAULT_VECTOR_HIGHLIGHT_FILL_COLOR: Color = Color.fromRgbaLike([0, 153, 255, 1]);
export const DEFAULT_VECTOR_HIGHLIGHT_TEXT_COLOR: Color = Color.fromRgbaLike([255, 255, 255, 1]);
export const DEFAULT_POINT_RADIUS = 5;
/**
 * Serialization interface
 */
export interface SymbologyDict {
    symbologyType: string;
}

// tslint:disable-next-line: no-empty-interface
export interface ISymbology {}


// TODO: Clean up...
export abstract class Symbology implements ISymbology {

    show = false; // TODO: remove

    static fromDict(
        dict: SymbologyDict, deprecated?: any
    ): Symbology {
        switch (dict.symbologyType) {
            case SymbologyType[SymbologyType.ICON_POINT]:
                return IconSymbology.createIconSymbology(dict as IconSymbologyDict);
            case SymbologyType[SymbologyType.SIMPLE_POINT]:
                return ComplexPointSymbology.createSimpleSymbology(dict as SimplePointSymbologyDict);
            case SymbologyType[SymbologyType.CLUSTERED_POINT]:
                return ComplexPointSymbology.createClusterSymbology(dict as VectorSymbologyDict);
            case SymbologyType[SymbologyType.COMPLEX_POINT]:
                return new ComplexPointSymbology(dict as ComplexPointSymbologyDict);
            case SymbologyType[SymbologyType.SIMPLE_VECTOR]:
                return ComplexVectorSymbology.createSimpleSymbology(dict as VectorSymbologyDict);
            case SymbologyType[SymbologyType.COMPLEX_VECTOR]:
                return ComplexVectorSymbology.createSimpleSymbology(dict as ComplexVectorSymbologyDict);
            case SymbologyType[SymbologyType.RASTER]:
                const rasterSymbologyDict = dict as RasterSymbologyDict;
                return new RasterSymbology({
                    hue: rasterSymbologyDict.hue,
                    opacity: rasterSymbologyDict.opacity,
                    saturation: rasterSymbologyDict.saturation,
                    unit: Unit.fromDict(rasterSymbologyDict.unit),
                });
            case SymbologyType[SymbologyType.MAPPING_COLORIZER_RASTER]:
                const mappingColorizerRasterSymbologyDict = dict as RasterSymbologyDict;
                return new MappingColorizerRasterSymbology({
                        hue: mappingColorizerRasterSymbologyDict.hue,
                        opacity: mappingColorizerRasterSymbologyDict.opacity,
                        saturation: mappingColorizerRasterSymbologyDict.saturation,
                        unit: Unit.fromDict(mappingColorizerRasterSymbologyDict.unit),
                        colorizer: ColorizerData.fromDict(mappingColorizerRasterSymbologyDict.colorizer)
                    });
            default:
                throw new Error('Unsupported Symbology');
        }
    }

    abstract getSymbologyType(): SymbologyType;

    get symbologyTypeId(): string {
        return SymbologyType[this.getSymbologyType()];
    }

    abstract clone(): Symbology;

    // abstract equals(other: Symbology): boolean; TODO: equals for symbologys?

    abstract toConfig(): ISymbology;

    abstract equals(other: Symbology): boolean;

    abstract toDict(): SymbologyDict;
}

export interface VectorSymbologyConfig extends ISymbology {
    fillRGBA: RgbaLike;
    strokeRGBA?: RgbaLike;
    strokeWidth?: number;
}

interface VectorSymbologyDict extends SymbologyDict {
    fillRGBA: RgbaTuple;
    strokeRGBA: RgbaTuple;
    strokeWidth: number;
}

export abstract class AbstractVectorSymbology extends Symbology {
    _fillColorBreakpoint: ColorBreakpoint = new ColorBreakpoint({rgba: DEFAULT_VECTOR_FILL_COLOR, value: 'Default fill color'});
    _strokeColorBreakpoint: ColorBreakpoint = new ColorBreakpoint({rgba: DEFAULT_VECTOR_STROKE_COLOR, value: 'Default stroke color'});

    // fillRGBA: Color = DEFAULT_VECTOR_FILL_COLOR;
    // strokeRGBA: Color = DEFAULT_VECTOR_STROKE_COLOR;
    strokeWidth = 1;

    abstract describesArea(): boolean;
    abstract describesRadius(): boolean;

    // Wrap colors in ColorBreakpoint for easy form usage
    set fillColorBreakpoint(colorBreakpoint: ColorBreakpoint) {
        this._fillColorBreakpoint = colorBreakpoint;
    }

    get fillColorBreakpoint(): ColorBreakpoint {
        return this._fillColorBreakpoint;
    }

    set strokeColorBreakpoint(colorBreakpoint: ColorBreakpoint) {
        this._strokeColorBreakpoint = colorBreakpoint;
    }

    get strokeColorBreakpoint(): ColorBreakpoint {
        return this._strokeColorBreakpoint;
    }

    // Wrap colors in ColorBreakpoint for easy form usage
    set fillRGBA(color: Color) {
        this._fillColorBreakpoint.setColor(color);
    }

    get fillRGBA(): Color {
        return this._fillColorBreakpoint.rgba;
    }

    set strokeRGBA(color: Color) {
        this._strokeColorBreakpoint.setColor(color);
    }

    get strokeRGBA(): Color {
        return this._strokeColorBreakpoint.rgba;
    }

    equals(other: AbstractVectorSymbology) {
        // console.log('AbstractVectorSymbology', 'equals', this, other);
        return other
            && this.fillColorBreakpoint.equals(other.fillColorBreakpoint)
            && this.strokeColorBreakpoint.equals(other.strokeColorBreakpoint)
            && this.strokeWidth === other.strokeWidth
            && this.describesArea() === other.describesArea()
            && this.describesRadius() === other.describesRadius();
    }


    setFillColorBreakpoint(colorBreakpoint: ColorBreakpoint) {
            this.fillColorBreakpoint = colorBreakpoint;
    }

    setStrokeColorBreakpoint(colorBreakpoint: ColorBreakpoint) {
            this.strokeColorBreakpoint = colorBreakpoint;
    }

    protected constructor(config: VectorSymbologyConfig) {
        super();
        this.fillRGBA = Color.fromRgbaLike(config.fillRGBA);
        if (config.strokeRGBA) { this.strokeRGBA = Color.fromRgbaLike(config.strokeRGBA); }
        if (config.strokeWidth) { this.strokeWidth = config.strokeWidth; }
    }
}




export class SimpleVectorSymbology extends AbstractVectorSymbology {

    static fromConfig(config: VectorSymbologyConfig) {
        return new SimpleVectorSymbology(config);
    }

    protected constructor(config: VectorSymbologyConfig) {
        super(config);
    }

    getSymbologyType(): SymbologyType {
        return SymbologyType.SIMPLE_VECTOR;
    }

    clone(): SimpleVectorSymbology {
        return new SimpleVectorSymbology(this);
    }

    toConfig(): VectorSymbologyConfig {
        return this.clone();
    }

    describesArea(): boolean {
        return true;
    }

    describesRadius(): boolean {
        return false;
    }

    toDict(): VectorSymbologyDict {
        return {
            symbologyType: SymbologyType[SymbologyType.SIMPLE_VECTOR],
            fillRGBA: this.fillRGBA.rgbaTuple(),
            strokeRGBA: this.strokeRGBA.rgbaTuple(),
            strokeWidth: this.strokeWidth,
        };
    }
}

export interface SimplePointSymbologyConfig extends VectorSymbologyConfig {
    radius?: number;
}

interface SimplePointSymbologyDict extends VectorSymbologyDict {
    radius: number;
}

export class SimplePointSymbology extends AbstractVectorSymbology implements SimplePointSymbologyConfig {
  radius = DEFAULT_POINT_RADIUS;

  protected constructor(config: SimplePointSymbologyConfig) {
      super(config);
      if (config.radius) {this.radius = config.radius; }
  }

  getSymbologyType(): SymbologyType {
      return SymbologyType.SIMPLE_POINT;
  }

  clone(): SimplePointSymbology {
      return new SimplePointSymbology(this);
  }

  toConfig(): SimplePointSymbologyConfig {
      return this.clone();
  }

  describesArea(): boolean {
      return true;
  }
  describesRadius(): boolean {
      return true;
  }

  equals(other: AbstractVectorSymbology) {
      // console.log('SimplePointSymbology', 'equals', this, other);
      if (other instanceof SimplePointSymbology) {
          return super.equals(other as AbstractVectorSymbology) && this.radius === other.radius;
      }
      return false;
  }

  toDict(): SimplePointSymbologyDict {
      return {
          symbologyType: SymbologyType[SymbologyType.SIMPLE_POINT],
          fillRGBA: this.fillRGBA.rgbaTuple(),
          strokeRGBA: this.strokeRGBA.rgbaTuple(),
          strokeWidth: this.strokeWidth,
          radius: this.radius,
      };
  }
}

export interface ComplexVectorSymbologyConfig extends VectorSymbologyConfig {
    colorizer?: IColorizerData;
    colorAttribute?: string;

    textAttribute?: string
    textColor?: RgbaLike;
    textStrokeWidth?: number;
}

export interface ComplexVectorSymbologyDict extends VectorSymbologyDict {
    colorizer: IColorizerData;
    colorAttribute: string;

    textAttribute: string
    textColor: RgbaLike;
    textStrokeWidth: number;
}

export interface ComplexPointSymbologyConfig extends SimplePointSymbologyConfig, ComplexVectorSymbologyConfig {
    radiusAttribute?: string;
}

interface ComplexPointSymbologyDict extends SimplePointSymbologyDict, ComplexVectorSymbologyDict {
    radiusAttribute: string;
}

export abstract class AbstractComplexVectorSymbology extends AbstractVectorSymbology {
    colorizer: ColorizerData;
    colorAttribute: string = undefined;

    textAttribute: string = undefined;
    textColor: Color = undefined;
    textStrokeWidth: number = undefined;

    protected constructor(config: ComplexVectorSymbologyConfig) {
        super(config);
        if (config.colorAttribute) {
            this.colorAttribute = config.colorAttribute;
        }
        this.colorizer = (config.colorizer) ? ColorizerData.fromDict(config.colorizer) : ColorizerData.empty();

        if (config.textAttribute) {
            this.textAttribute = config.textAttribute;
        }
        this.textColor = config.textColor ? Color.fromRgbaLike(config.textColor) : WHITE;
        this.textStrokeWidth = config.textStrokeWidth ? config.textStrokeWidth : Math.ceil(config.strokeWidth * 0.1);
    }

    setColorAttribute(name: string, clr: ColorizerData = ColorizerData.empty()) {
        this.colorizer = clr;
        this.colorAttribute = name;
    }

    setOrUpdateColorizer(clr: ColorizerData): boolean {
        if (clr && (!this.colorizer || !clr.equals(this.colorizer))) {
            this.colorizer = clr;
            return true;
        }
        return false;
    }

    unSetColorAttribute() {
        this.colorAttribute = undefined;
        this.colorizer = ColorizerData.empty()
    }

    equals(other: AbstractVectorSymbology) {
        // console.log('ComplexPointSymbology', 'equals', this, other);
        if (other instanceof AbstractComplexVectorSymbology) {
            return super.equals(other as AbstractComplexVectorSymbology)
                && this.colorizer && this.colorizer.equals(other.colorizer)
                && this.colorAttribute && other.colorAttribute && this.colorAttribute === other.colorAttribute
                && this.textColor && this.textColor.equals(other.textColor)
                && this.textStrokeWidth && other.textStrokeWidth && this.textStrokeWidth === other.textStrokeWidth
                && this.textAttribute && other.textAttribute && this.textAttribute === other.textAttribute;
        }
        return false;
    }

    toDict(): ComplexVectorSymbologyDict {
        return {
            symbologyType: SymbologyType[SymbologyType.COMPLEX_VECTOR],
            fillRGBA: this.fillRGBA.rgbaTuple(),
            strokeRGBA: this.strokeRGBA.rgbaTuple(),
            strokeWidth: this.strokeWidth,
            colorAttribute: this.colorAttribute,
            colorizer: this.colorizer ? this.colorizer.toDict() : undefined,
            textAttribute: this.textAttribute,
            textColor: this.textColor.rgbaTuple(),
            textStrokeWidth: this.textStrokeWidth,
        }
    }

}

export class ComplexVectorSymbology extends AbstractComplexVectorSymbology implements ComplexVectorSymbologyConfig {

    protected constructor(config: ComplexVectorSymbologyConfig) {
        super(config);
    }

    static createSimpleSymbology(config: ComplexVectorSymbologyConfig): ComplexVectorSymbology {
        return new ComplexVectorSymbology(config);
    }

    describesArea(): boolean {
        return true;
    }
    describesRadius(): boolean {
       return false;
    }
    getSymbologyType(): SymbologyType {
        return SymbologyType.COMPLEX_VECTOR;
    }
    clone(): ComplexVectorSymbology {
        return new ComplexVectorSymbology(this);
    }
    toConfig(): ComplexVectorSymbologyConfig {
        return this.clone();
    }
}

export class ComplexPointSymbology extends AbstractComplexVectorSymbology implements ComplexPointSymbologyConfig {

    radiusAttribute: string = undefined;
    radius: number = DEFAULT_POINT_RADIUS;

    constructor(config: ComplexPointSymbologyConfig) {
        super(config);
        // console.log('ComplexPointSymbology', config);
        if (config.radius) {
            this.radius = config.radius;
        }

        if (config.radiusAttribute) {
            this.radiusAttribute = config.radiusAttribute;
        }
    }

    /**
     * Creates a ComplexPointSymbology where radiusAttribute and textAttribute are set to the strings returned by Mappings cluster operator
     * @param {ComplexPointSymbologyConfig} config
     * @returns {ComplexPointSymbology}
     */
    static createClusterSymbology(config: ComplexPointSymbologyConfig): ComplexPointSymbology {
        config['radiusAttribute'] = '___radius';
        config['textAttribute'] = '___numberOfPoints';
        config['clustered'] = true;

        return new ComplexPointSymbology(config);
    }

    static createSimpleSymbology(config: ComplexPointSymbologyConfig): ComplexPointSymbology {
        return new ComplexPointSymbology(config);
    }

    getSymbologyType(): SymbologyType {
        return SymbologyType.COMPLEX_POINT;
    }

    clone(): ComplexPointSymbology {
        return new ComplexPointSymbology(this);
    }

    equals(other: AbstractVectorSymbology) {
        // console.log('ComplexPointSymbology', 'equals', this, other);
        if (other instanceof ComplexPointSymbology) {
            return super.equals(other as SimplePointSymbology)
            && this.radiusAttribute && other.radiusAttribute && this.radiusAttribute === other.radiusAttribute;
        }
        return false;
    }

    toConfig(): ComplexPointSymbologyConfig {
        return this.clone();
    }

    describesArea(): boolean {
        return true;
    }
    describesRadius(): boolean {
        return true;
    }

    toDict(): ComplexPointSymbologyDict {
        return {
            symbologyType: SymbologyType[SymbologyType.COMPLEX_POINT],
            fillRGBA: this.fillRGBA.rgbaTuple(),
            strokeRGBA: this.strokeRGBA.rgbaTuple(),
            strokeWidth: this.strokeWidth,
            colorAttribute: this.colorAttribute,
            colorizer: this.colorizer ? this.colorizer.toDict() : undefined,
            radiusAttribute: this.radiusAttribute,
            radius: this.radius,
            textAttribute: this.textAttribute,
            textColor: this.textColor.rgbaTuple(),
            textStrokeWidth: this.textStrokeWidth,
        }
    }
}

export interface IRasterSymbology extends ISymbology {
    opacity?: number;
    hue?: number;
    saturation?: number;
    unit: Unit;
}

export interface RasterSymbologyDict extends SymbologyDict {
    opacity: number;
    hue: number;
    saturation: number;
    unit: UnitDict;
    colorizer?: IColorizerData;
    noDataColor?: ColorBreakpointDict;
    overflowColor?: ColorBreakpointDict;
}

export class RasterSymbology extends Symbology implements IRasterSymbology {
    opacity = 1;
    hue = 0;
    saturation = 0;
    unit: Unit;

    constructor(config: IRasterSymbology) {
        super();
        this.unit = config.unit;
        if (config.opacity) { this.opacity = config.opacity; }
        if (config.hue) { this.hue = config.hue; }
        if (config.saturation) { this.saturation = config.saturation; }
    }

    isContinuous() {
        return this.unit.interpolation === Interpolation.Continuous;
    }

    isDiscrete() {
        return this.unit.interpolation === Interpolation.Discrete;
    }

    isUnknown() {
        return !this.unit || !this.unit.interpolation || this.unit.interpolation === 0;
    }

    getSymbologyType(): SymbologyType {
        return SymbologyType.RASTER;
    }

    toConfig(): IRasterSymbology {
        return this.clone();
    }

    clone(): RasterSymbology {
        return new RasterSymbology(this);
    }

    equals(other: RasterSymbology) {
        // console.log('RasterSymbology', 'equals', this, other);
        return this.saturation === other.saturation
            && this.opacity === other.opacity
            && this.hue === other.hue
            && this.unit === other.unit;
    }

    toDict(): RasterSymbologyDict {
        return {
            symbologyType: SymbologyType[SymbologyType.RASTER],
            opacity: this.opacity,
            hue: this.hue,
            saturation: this.saturation,
            unit: this.unit.toDict(),
        };
    }
}

export interface IColorizerRasterSymbology extends IRasterSymbology {
    colorizer?: IColorizerData;
    noDataColor?: ColorBreakpointDict;
    overflowColor?: ColorBreakpointDict;
}

export class MappingColorizerRasterSymbology extends RasterSymbology
    implements IColorizerRasterSymbology {

    colorizer: ColorizerData;
    noDataColor: ColorBreakpoint;
    overflowColor: ColorBreakpoint;

    constructor(config: IColorizerRasterSymbology) {
        super(config);
        // TODO don't create grayscale
        this.colorizer = (config.colorizer) ? new ColorizerData(config.colorizer) : ColorizerData.grayScaleColorizer(config.unit);
        this.noDataColor = (config.noDataColor) ? new ColorBreakpoint(config.noDataColor)
            : new ColorBreakpoint({rgba: TRANSPARENT, value: 'NoData'});
        this.overflowColor = (config.overflowColor) ? new ColorBreakpoint(config.overflowColor)
            : new ColorBreakpoint({rgba: TRANSPARENT, value: 'Overflow'});
    }

    getSymbologyType(): SymbologyType {
        return SymbologyType.MAPPING_COLORIZER_RASTER;
    }

    isUnknown(): boolean {
        return super.isUnknown();
    }

    toConfig(): IColorizerRasterSymbology {
        return this.clone() as IColorizerRasterSymbology;
    }

    clone(): MappingColorizerRasterSymbology {
        return new MappingColorizerRasterSymbology(this);
    }

    equals(other: RasterSymbology) {
        // console.log('MappingColorizerRasterSymbology', 'equals', this, other);
        if (other instanceof MappingColorizerRasterSymbology) {
            return super.equals(other as RasterSymbology)
                && this.colorizer && this.colorizer.equals(other.colorizer)
                && this.noDataColor && this.noDataColor.equals(other.noDataColor)
                && this.overflowColor && this.overflowColor.equals(other.overflowColor);
        }
        return false;
    }

    toDict(): RasterSymbologyDict {
        return {
            symbologyType: SymbologyType[SymbologyType.MAPPING_COLORIZER_RASTER],
            opacity: this.opacity,
            hue: this.hue,
            saturation: this.saturation,
            unit: this.unit.toDict(),
            colorizer: this.colorizer.toDict(),
            noDataColor: this.noDataColor.toDict(),
            overflowColor: this.overflowColor.toDict()
        };
    }

    mappingColorizerRequestString(): string {
        const mcbs: MappingRasterColorizerDict = {
            type: this.colorizer.type,
            nodata: this.noDataColor.asMappingRasterColorizerBreakpoint(),
            overflow: this.overflowColor.asMappingRasterColorizerBreakpoint(),
            breakpoints: this.colorizer.breakpoints.map(br => br.asMappingRasterColorizerBreakpoint())
        };
        return JSON.stringify(mcbs);
    }
}


interface IconAttribute {
    name: string,
    uri: string,
}

export class IconSymbology extends AbstractComplexVectorSymbology {
    _iconColor: ColorBreakpoint = new ColorBreakpoint({rgba: Color.fromRgbaLike([0, 0, 0, 0]), value: 'Default'});

    set iconColorBreakpoint(colorBreakpoint: ColorBreakpoint) {
        this._iconColor = colorBreakpoint;
        this.color = this._iconColor.rgba;
    }

    get iconColorBreakpoint(): ColorBreakpoint {
        return this._iconColor;
    }

    clone(): IconSymbology {
        return IconSymbology.fromConfig(this.toDict());
    }
    uri = 'assets/icons/happyWhale.png';
    color?: Color;
    rotation = 0;
    scale = 1;
    opacity = 1;

    static fromConfig(config: IconSymbologyConfig) {
        return new IconSymbology(config);
    }

    protected constructor(config: IconSymbologyConfig) {
        super(config);
        if (config.uri !== undefined) {
            this.uri = config.uri;
        }
        if (config.color !== undefined) {
            this.color = Color.fromRgbaLike(config.color);
            this._iconColor = new ColorBreakpoint({rgba: this.color.rgbaTuple(), value: this.color.rgbaCssString()});
        }
        if (config.rotation !== undefined) {
            this.rotation = config.rotation;
        }
        if (config.scale !== undefined) {
            this.scale = config.scale;
        }
        if (config.opacity !== undefined) {
            this.opacity = config.opacity;
        }
    }

    describesArea(): boolean {
        return false;
    }

    describesRadius(): boolean {
        return false;
    }

    getSymbologyType(): SymbologyType {
        return SymbologyType.ICON_POINT;
    }

    toConfig(): IconSymbologyConfig {
        return {
            fillRGBA: undefined,
            strokeRGBA: undefined,
            strokeWidth: 0,
            uri: this.uri
        };
    }

    toDict(): IconSymbologyDict {
        return {
            colorAttribute: '', colorizer: undefined, textAttribute: '', textColor: undefined, textStrokeWidth: 0,
            fillRGBA: undefined,
            strokeRGBA: undefined,
            strokeWidth: 0,
            uri: this.uri,
            rotation: this.rotation,
            opacity: this.opacity,
            scale: this.scale,
            color: this.color,
            symbologyType: SymbologyType[SymbologyType.ICON_POINT]
        };
    }

    static createIconSymbology(config: IconSymbologyConfig): IconSymbology {
        return new IconSymbology(config);
    }
}


interface IconSymbologyDict extends ComplexVectorSymbologyDict  {
    uri?: string;
    color?: Color;
    rotation?: number;
    scale?: number;
    opacity?: number;
}

export interface IconSymbologyConfig extends ComplexVectorSymbologyConfig {
    uri?: string;
    color?: Color;
    rotation?: number;
    scale?: number;
    opacity?: number;
}
