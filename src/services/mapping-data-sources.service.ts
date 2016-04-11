import {Injectable} from "angular2/core";
import {Http, Response} from "angular2/http";
import {Observable} from "rxjs/Rx";
import {MappingSource} from "../mapping-source.model";

@Injectable()
export class MappingDataSourcesService {

  constructor(private http: Http) { }

    getSources(): Observable<Array<MappingSource>> {
      return this.http.get("assets/mapping-data-sources.json").map((res: Response) => res.json()).map((json: JSON) => {
        let arr: Array<MappingSource> = [];

        for (let sourceId in json["sourcelist"]) {
          let source = json["sourcelist"][sourceId];
          arr.push({
            source: sourceId,
            name: source.name,
            colorizer: source.colorizer,
            coords: source.coords,
            channels: source.channels.map((channel: any, index: number) => {
              channel.id = index;
              channel.name = channel.name || "Channel #"+index;
                /*
                channel.preview = Config.MAPPING_URL+"?SERVICE=WMS"+
                "&VERSION="+Config.WMS_VERSION+
                "&REQUEST=GetMap"+
                "&FORMAT="+Config.WMS_FORMAT+
                "&COLORS="+(channel.colorizer||source.colorizer||"grey")+
                "&LAYERS={\"type\":\"source\",\"params\":\{\"sourcename\":\""+ sourceId +"\",\"channel\":"+channel.id+"}}"+
                "&WIDTH="+140+
                "&HEIGHT="+70+
                "&BBOX="+[-90,-180,90,180].join(",")+
                "&crs=EPSG:"+source.coords.epsg+
                "&DEBUG="+(Config.DEBUG_MODE? 1:0);
                */
              return channel;
            })
          });
        }

        return arr;
      });
    }

}
