import React, {useRef, useState} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer, PolygonLayer} from '@deck.gl/layers';
import {LightingEffect, AmbientLight, DirectionalLight, _SunLight as SunLight} from '@deck.gl/core';
import {scaleLinear} from 'd3-scale';
import Typography from '@material-ui/core/Typography';
import Slider from '@material-ui/core/Slider';

// Source data GeoJSON
const DATA_URL =
  './data/geo-processed4.json'; // eslint-disable-line

export const HEATMAP_COLORS = scaleLinear()
  .domain([0, 12, 30, 100])
  .range([
    [54, 194, 40],
    [15, 62, 21],
    [176, 150, 30],
    [255, 0, 0]
  ]);

const INITIAL_VIEW_STATE = {
  latitude: 69.0,
  longitude: 102.18,
  zoom: 1.7,
  maxZoom: 16,
  pitch: 30,
  bearing: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const dirLight = new DirectionalLight({
  direction: [-50, -200, -500],
  color: [255, 255, 255],
  intensity: 1.0,
  _shadow: true
});

const landCover = [[[0, 82], [200.0, 82], [200, 20], [0,20]]];

const MIN_WEEK = 15; //12 for yandex dataset
const MAX_WEEK = 43; //49 for yandex dataset

const formatGood = (n) => Intl.NumberFormat().format(n);
const formatDiff = (n) => (n>0?'+':'') + formatGood(n);
const formatProc = (n) => (n*100).toFixed(2)+'%';
const formatDate = (d) => String(d.getDate()).padStart(2, '0') + '.' + String(1 + d.getMonth()).padStart(2, '0') + '.' + d.getFullYear();

const lerp = (a,b,p) => a + (b-a)*p;
const lerp3 = (c1,c2,p) => [lerp(c1[0],c2[0],p),lerp(c1[1],c2[1],p),lerp(c1[2],c2[2],p)];


function getTooltip({object}) {
  if (!object) return;

  let cw = Math.floor(currentWeek);
  let region_name = object.properties.corona['name'];
  let population = object.properties.corona['count'];
  
  let cases_actual = object.properties.corona['arr'][cw]['c'];
  let cases_all = object.properties.corona['arr'][cw]['ac'];
  let cases_new = object.properties.corona['arr'][cw]['nc'];

  let healed_all = object.properties.corona['arr'][cw]['ah'];
  let healed_new = object.properties.corona['arr'][cw]['nh'];

  let death_all = object.properties.corona['arr'][cw]['ad'];
  let death_new = object.properties.corona['arr'][cw]['nd'];

  let work_applications = object.properties.work['val'][cw];
  let work_applications_mult = object.properties.work['proc'][cw];
  let work_applications_all = 0;

  for (let i = MIN_WEEK; i <= cw; i++)
    work_applications_all += object.properties.work['val'][i];

  return (
    object && {
      html: `\
  <div><b>${region_name}</b></div>
  <div>Население: ${formatGood(population)}</div>
  <hr/>
  <div><b>Covid-19</b></div>
  <div>Больных: ${formatGood(cases_actual)} (${formatDiff(cases_new - healed_new - death_new)})</div>
  <div>Заражений: ${formatGood(cases_all)} (${formatDiff(cases_new)})</div>

  <div>Переболевших: ${formatGood(healed_all)} (${formatDiff(healed_new)})</div>
  <div>Смертей: ${formatGood(death_all)} (${formatDiff(death_new)})</div>

  <div style=\"margin-top:5px; font-size:6pt;\" >
  По данным сайта стопкоронавирус.рф и Университета Джонса Хопкинса.
  </div>
  <hr/>
  <div><b>Безработица</b></div>
  <div>Количество заявок: ${formatGood(work_applications_all)} (${formatDiff(work_applications)})</div>
  <div>По сравнению со средним: ${formatProc(work_applications_mult)}</div>
  <div style=\"margin-top:5px; font-size:6pt;\" >
  «Обезличенные сведения из резюме пользователей портала “Работа в России”».
  Источник: Роструд; обработка: Инфраструктура научно-исследовательских данных, АНО «ЦПУР», 2020. (набор данных получен в рамках хакатона PandemicDataHack, 18-20 декабря 2020).
  </div>
  `,
    style:{
      "max-width": "300px"
    }
    }
  );
}

function rndColor(i) {
  return [Math.floor((Math.sin(12134.21234234*i)*.5+.5)*255),
    Math.floor((Math.sin(1.3412321*i)*.5+.5)*255),
    Math.floor((Math.cos(14.32132121*i)*.5+.5)*255)];
}

function rndElevation(i) {
  return Math.sin(12456.31234*i)*.5+.5;
}

let currentWeek = MIN_WEEK;
let hovered = -1;
function calcColor(f) {
  let cw = Math.floor(currentWeek);
  let nw = Math.ceil(currentWeek);

  let pw = currentWeek-cw;

  let cp = f.properties.corona['arr'][cw]['c'];
  let np = f.properties.corona['arr'][nw]['c'];

  let population = f.properties.corona['count'];

  //let p = Math.log((cp + (np-cp) * pw)+1)/Math.log(population/100);
  let p = (cp + (np-cp) * pw)/population*100.0;
  p = Math.min(p, 1.0);

  let col = HEATMAP_COLORS(p*100);

  if (f.properties['ID_LAW'] == hovered)
    col = lerp3(col, [255,255,255], 0.2);

  return col;
}

function calcElevation(f) {
  let cw = Math.floor(currentWeek);
  let nw = Math.ceil(currentWeek);
  let pw = currentWeek-cw;

  let cp = f.properties.work['proc'][Math.max(MIN_WEEK, Math.min(MAX_WEEK,cw))];
  let np = f.properties.work['proc'][Math.max(MIN_WEEK, Math.min(MAX_WEEK,nw))];

  let p = cp + (np-cp) * pw;
  return p;
}

let global_corona = null;
let global_work = null;

function getGlobalCoronaWeek(w) {
  if (!global_corona) return 0;
  let cw = Math.floor(w);
  let nw = Math.ceil(w);
  let pw = w-cw;

  let cp = global_corona[cw];
  let np = global_corona[nw];

  let p = cp + (np-cp) * pw;
  return Math.floor(p);
}

function getGlobalWorkWeek(w) {
  if (!global_work) return 0;
  let cw = Math.floor(w);
  let nw = Math.ceil(w);
  let pw = w-cw;

  let cp = global_work[cw];
  let np = global_work[nw];

  let p = cp + (np-cp) * pw;
  return Math.floor(p);
}

let layers = [];
export default function App({data = DATA_URL, mapStyle = MAP_STYLE}) {
  const [values, setData] = useState(() => {
    const lightingEffect = new LightingEffect({ambientLight, dirLight});
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return {effects: [lightingEffect]};
  });

  const geojsonLoaded = (data, layer) => {
    global_corona = {}; global_work = {};
    for (let i = MIN_WEEK; i <= MAX_WEEK; i++) {
      global_corona[i] = 0;
      global_work[i] = 0;
      for (let r = 0; r < data['features'].length; r++) {
        global_corona[i] += data['features'][r]['properties']['corona']['arr'][i]['c'];
        global_work[i] += data['features'][r]['properties']['work']['val'][i];
      }
    }
    setData(state => ({...state, currentWeek}));
  }


  const onHover = (d) => {


    hovered = d.index == -1 ? -1 : d.object['properties']['ID_LAW'];
    setData(state => ({...state, hovered}));
  }

  layers = [
    // only needed when using shadows - a plane for shadows to drop on
    new PolygonLayer({
      id: 'ground',
      data: landCover,
      stroked: false,
      getPolygon: f => f,
      getFillColor: [0,0,0,0]
    }),
    new GeoJsonLayer({
      id: 'geojson',
      data,
      opacity: 0.8,
      filled: true,
      extruded: true,
      wireframe: false,
      getElevation: f => calcElevation(f)*1000000,
      getFillColor: calcColor,
      pickable: true,
      onDataLoad: geojsonLoaded,
      highlightColor: [255,255,255,20],
      onHover: onHover,
      //autoHighlight: true, // breaks shadoe
      updateTriggers: {
        // This tells deck.gl to recalculate when `currentWeek` changes
        getFillColor: [currentWeek, hovered],
        getElevation: currentWeek,
      },
    })
  ];

  const sliderChanged = (e, val) => {
    currentWeek = val;
    setData(state => ({...state, currentWeek}));
  };

  const curDate = new Date(2019,11,30 + Math.floor(currentWeek)*7);
  const curEndDate = new Date(2019,11,30 + Math.floor(currentWeek)*7 + 6);

  return (
    <div className="app">
    <DeckGL ref = {el => deck = el}
      layers={layers}
      effects={values.effects}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
      style={{background: "#d4dadc"}}
    >
      <div className="label">
        Влияние пандемии на безработицу в России
      </div>
      <div className="statDate">
        Неделя {Math.floor(currentWeek+1)} ({formatDate(curDate)} - {formatDate(curEndDate)})
      </div>
      <div className="statInfo">
        <div className="statCorona"><span>Число больных Covid-19 в России: {formatGood(getGlobalCoronaWeek(currentWeek))}</span></div>
        <div className="statWork"><span>Число заявок по безработице: {formatGood(getGlobalWorkWeek(currentWeek))}</span></div>
      </div>
      <StaticMap reuseMaps mapStyle={mapStyle} preventStyleDiffing={true} />
    </DeckGL>
    <div className="slider">
    <Slider
        defaultValue={MIN_WEEK}
        getAriaValueText={valuetext}
        aria-labelledby="continuous-slider"
        step={0.0001}
        onChange={sliderChanged}
        min={MIN_WEEK} //12
        max={MAX_WEEK} //49
        valueLabelDisplay="auto"
        valueLabelFormat={v=>Math.floor(v+1)}
      />
    </div>
    </div>
  );
}

let deck;
let application;
export function renderToDOM(container) {
  application = render(<App />, container);
}


function valuetext(value) {
  return `Week: ${value}`;
}