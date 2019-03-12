import {Unit, UnitMappingDict} from '../../unit.model';
import {MappingRasterColorizerDict} from '../../../colors/colorizer-data.model';
import {IColorizerData} from '../../../colors/colorizer-data.model';

export interface MappingTransform {
  datatype: string;
  offset: number;
  scale: number;
  unit: Unit;
}

export interface Coords {
    crs: string,
    origin: number[],
    scale: number[],
    size: number[],
}

export interface ProvenanceInfo {
    uri: string;
    license: string;
    citation: string;
}

export interface MappingSourceRasterLayer {
    name: string;
    id: number;
    datatype: string;
    nodata: number;
    unit: Unit;
    colorizer: IColorizerData;
    transform: MappingTransform;
    hasTransform: boolean;
    isSwitchable: boolean;
    missingUnit?: boolean;
    coords: Coords;
    provenance: ProvenanceInfo;
    file_name?: string;
    channel?: number;
}

export interface MappingSourceVectorLayer {
    name: string;
    id: number | string;
    title: string;
    geometryType: string; // FIXME: this must be the layer type -> POINT, POLYGON, LINE...
    textual: string[];
    numeric: string[];
    coords: {
        crs: string
    };
    colorizer?: IColorizerData;
    provenance: ProvenanceInfo;
}

export interface MappingSource {
    operator: string;
    source: string;
    name: string;
    rasterLayer?: MappingSourceRasterLayer[];
    vectorLayer?: MappingSourceVectorLayer[];
    descriptionText?: string;
    imgUrl?: string;
    provenance: ProvenanceInfo;
}

// MAPPING DICTS

export interface MappingCoordsDict {
    crs: string;
    epsg?: number;
    origin?: number[];
    scale?: number[];
    size?: number[];
}

interface MappingProvenanceDict {
    uri: string;
    license: string;
    citation: string;
}

interface MappingTransformDict {
    unit?: UnitMappingDict,
    datatype: string,
    scale: number,
    offset: number,
}

export interface MappingChannelDict {
    datatype: string,
    nodata: number,
    name?: string,
    channel?: number,
    file_name?: string,
    unit?: UnitMappingDict,
    colorizer?: MappingRasterColorizerDict,
    transform?: MappingTransformDict,
    coords: MappingCoordsDict,
    provenance?: MappingProvenanceDict,
}

interface MappingLayerDict {
    id?: number | string,
    name: string,
    title?: string,
    geometry_type: string, // FIXME: this must be the layer type -> POINT, POLYGON, LINE...
    textual?: string[],
    numeric?: string[],
    coords: { // TODO: merge with MappingCoordsDict?
        crs: string,
    };
    // uri?: string,
    // license?: string,
    // citation?: string,
    provenance?: MappingProvenanceDict
}

export interface MappingSourceDict {
    operator?: string,
    name: string,
    file_name?: string;
    descriptionText?: string,
    imgUrl?: string,
    colorizer?: MappingRasterColorizerDict,
    provenance?: MappingProvenanceDict;
    coords: MappingCoordsDict,
    channels?: MappingChannelDict[];
    layer?: MappingLayerDict[];
}

export interface MappingSourceResponse {
    sourcelist: {[index: string]: MappingSourceDict};
}
