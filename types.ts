
export enum ExportType {
  MAP = 'map',
  MODEL = 'model',
  ATLAS = 'atlas'
}

export enum PaperSize {
  A4 = 'A4',
  A3 = 'A3',
  A2 = 'A2',
  A1 = 'A1',
  A0 = 'A0'
}

export interface SymbolOverride {
  type: string;
  category: 'point' | 'line' | 'area';
  color?: string;
  scale?: number;
  visible: boolean;
  symbolSet?: string; 
}

export interface ThFileMetadata {
  id: string;
  fileName: string;
  type: 'th' | 'th2' | 'thconfig' | 'txt' | 'other';
  content?: string;
}

export interface MetapostModule {
  id: string;
  nameSk: string;
  descriptionSk: string;
  code: string;
  category: 'metapost' | 'tex' | 'core';
  isCustom?: boolean;
}

export interface GeneratorSettings {
  caveName: string;
  selectName: string;
  author: string;
  scale: number;
  language: string;
  exportTypes: ExportType[];
  colorScheme: string;
  mapBgColor: string; 
  mapFgColor: string; 
  printMode: boolean;
  paperSize: PaperSize;
  
  // Header & Legend Specifics
  showLegend: boolean;
  legendWidth: number;
  legendColumns: number;
  headerX: number;
  headerY: number;
  headerAnchor: string;
  headerBg: boolean;
  defaultSymbolSet: string;
  
  // Logo
  logoPath: string;
  logoWidth: number;
  
  // TeX Content
  topoTeam: string;
  cartoTeam: string;
  exploTeam: string;
  exploTitle: string;
  comment: string;
  caveNameFontSize: number;
  hideLength: boolean;
  hideDepth: boolean;
  showBorder: boolean;
  borderThickness: number;

  // Survey / Centreline
  showSurvey: boolean;
  surveyColor: string;
  surveyStyle: 'solid' | 'dashed' | 'dotted';
  debugStationNames: boolean;
  stationLabelSize: number;
  
  // Presentation
  rotation: number;
  transparency: boolean;
  overlap: number;
  scaleBarLength: number;
  
  // Grid
  showGrid: boolean;
  gridSize: number;

  hidePassageHeight: boolean;
  hideBlocks: boolean;

  uploadedFiles: ThFileMetadata[];
  enabledModules: string[];
  customModules: MetapostModule[];
  symbolOverrides: Record<string, SymbolOverride>;
}
