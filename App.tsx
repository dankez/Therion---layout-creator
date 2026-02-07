
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExportType, GeneratorSettings, PaperSize, ThFileMetadata, SymbolOverride, MetapostModule } from './types';
import { EXTRA_MODULES, THEME_TEMPLATES, ThemeTemplate } from './constants';
import { generateConfigFile, generateLayoutFile } from './services/therionGenerator';
import { GoogleGenAI, Type } from "@google/genai";

const downloadFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const getContrastColor = (hex: string) => {
  if (!hex || !hex.startsWith('#')) return '#000000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
};

const SYMBOL_SETS = ['AUT', 'UIS', 'SKBB', 'BCRA', 'NSS', 'NZSS', 'ASF'];

const ANCHORS = [
  { id: 'nw', x: 5, y: 5, pos: 'Top-Left' }, { id: 'n', x: 50, y: 5, pos: 'Top' }, { id: 'ne', x: 95, y: 5, pos: 'Top-Right' },
  { id: 'w', x: 5, y: 50, pos: 'Left' }, { id: 'center', x: 50, y: 50, pos: 'Center' }, { id: 'e', x: 95, y: 50, pos: 'Right' },
  { id: 'sw', x: 5, y: 95, pos: 'Bottom-Left' }, { id: 's', x: 50, y: 95, pos: 'Bottom' }, { id: 'se', x: 95, y: 95, pos: 'Bottom-Right' }
];

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<GeneratorSettings>({
    caveName: 'Hacavská jaskyňa',
    selectName: 'scrap1@kluc',
    author: 'Michal Danko',
    scale: 100,
    language: 'sk',
    exportTypes: [ExportType.MAP],
    colorScheme: 'custom',
    mapBgColor: '#f5f2e8', 
    mapFgColor: '#e8e2d0', 
    printMode: false,
    paperSize: PaperSize.A4,
    showLegend: true,
    legendWidth: 60,
    legendColumns: 3,
    headerX: 5,
    headerY: 5,
    headerAnchor: 'nw',
    headerBg: true,
    defaultSymbolSet: 'AUT',
    logoPath: 'logo.jpg',
    logoWidth: 4,
    topoTeam: 'Michal Danko a spol.',
    cartoTeam: 'Michal Danko',
    exploTeam: 'SK Nicolaus',
    exploTitle: 'Prieskum',
    comment: 'Zamerané v roku 2024.',
    caveNameFontSize: 30,
    hideLength: false,
    hideDepth: false,
    showBorder: true,
    borderThickness: 0.5,
    showSurvey: true,
    surveyColor: '#4a3728',
    surveyStyle: 'solid',
    debugStationNames: true,
    stationLabelSize: 8,
    rotation: 0,
    transparency: true,
    overlap: 5,
    scaleBarLength: 20,
    showGrid: false,
    gridSize: 10,
    hidePassageHeight: false,
    hideBlocks: false,
    uploadedFiles: [],
    enabledModules: [],
    customModules: [],
    symbolOverrides: {}
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'symbols' | 'header' | 'extra' | 'code'>('preview');
  const [codeTab, setCodeTab] = useState<'layout' | 'config'>('layout');
  const [layoutFileContent, setLayoutFileContent] = useState('');
  const [configFileContent, setConfigFileContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleCode, setNewModuleCode] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const updateFiles = useCallback(() => {
    setLayoutFileContent(generateLayoutFile(settings));
    setConfigFileContent(generateConfigFile(settings, 'layout.thl'));
  }, [settings]);

  useEffect(() => {
    updateFiles();
  }, [updateFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    let allNewOverrides: Record<string, SymbolOverride> = { ...settings.symbolOverrides };
    const newFiles: ThFileMetadata[] = await Promise.all(files.map(async (f: File) => {
      const content = await f.text();
      let type: ThFileMetadata['type'] = 'other';
      if (f.name.endsWith('.th')) type = 'th';
      else if (f.name.endsWith('.th2')) {
        type = 'th2';
        const lines = content.split('\n');
        lines.forEach(line => {
          const t = line.trim();
          if (t.startsWith('point ') || t.startsWith('line ') || t.startsWith('area ')) {
            const parts = t.split(/\s+/);
            const cat = parts[0] as any;
            const symType = parts[cat === 'point' ? 3 : 1];
            if (symType && !allNewOverrides[symType]) {
              allNewOverrides[symType] = { type: symType, category: cat, visible: true, color: '#000000', symbolSet: 'DEFAULT' };
            }
          }
        });
      }
      return { id: Math.random().toString(36).substr(2, 9), fileName: f.name, type, content };
    }));
    setSettings(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...newFiles], symbolOverrides: allNewOverrides }));
  };

  const applyTemplate = (template: ThemeTemplate) => {
    setSettings(prev => ({
      ...prev,
      mapBgColor: template.bgColor,
      mapFgColor: template.fgColor,
      surveyColor: template.surveyColor
    }));
  };

  const analyzeColorsWithAI = async () => {
    if (Object.keys(settings.symbolOverrides).length === 0) {
      alert("Najprv nahrajte .th2 súbor so symbolmi.");
      return;
    }
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const symbolList = Object.keys(settings.symbolOverrides).join(', ');
      const prompt = `Si expert na Therion kartografiu. Navrhni estetické farby pre symboly: ${symbolList}.
      Aktuálne farby mapy: pozadie ${settings.mapBgColor}, chodba ${settings.mapFgColor}.
      Vráť striktný JSON: { "overrides": [{"type": "string", "color": "hex"}] }. Použi farby, ktoré budú čitateľné na danom pozadí.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overrides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    color: { type: Type.STRING }
                  },
                  required: ["type", "color"]
                }
              }
            },
            required: ["overrides"]
          }
        }
      });
      
      const data = JSON.parse(response.text);
      const newOverrides = { ...settings.symbolOverrides };
      data.overrides.forEach((ov: any) => {
        if (newOverrides[ov.type]) newOverrides[ov.type].color = ov.color;
      });
      setSettings(prev => ({ ...prev, symbolOverrides: newOverrides }));
    } catch (err) {
      console.error(err);
      alert("AI analýza zlyhala. Skontrolujte pripojenie.");
    } finally {
      setAiLoading(false);
    }
  };

  const addCustomModule = () => {
    if (!newModuleName || !newModuleCode) return;
    const mod: MetapostModule = {
      id: 'custom_' + Date.now(),
      nameSk: newModuleName,
      descriptionSk: 'Užívateľský Metapost kód',
      code: newModuleCode,
      category: 'metapost',
      isCustom: true
    };
    setSettings(s => ({...s, customModules: [...s.customModules, mod], enabledModules: [...s.enabledModules, mod.id]}));
    setNewModuleName('');
    setNewModuleCode('');
  };

  const updateSymbolOverride = (type: string, data: Partial<SymbolOverride>) => {
    setSettings(prev => ({ ...prev, symbolOverrides: { ...prev.symbolOverrides, [type]: { ...prev.symbolOverrides[type], ...data } } }));
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); } catch (err) { console.error(err); }
  };

  const previewTextColor = getContrastColor(settings.mapFgColor);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 text-slate-900">
      <header className="bg-[#0f172a] text-white p-5 shadow-2xl sticky top-0 z-50 flex justify-between items-center border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-xl text-xl shadow-lg shadow-blue-500/20">🗺️</div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Therion <span className="text-blue-500">Danko Architect</span></h1>
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Version 7.5 (Enterprise)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <label className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2">
            <span>📂 NAHRAŤ .TH2</span>
            <input type="file" multiple className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
          </label>
          <button onClick={() => downloadFile(layoutFileContent, 'layout.thl')} className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-xl shadow-blue-500/20">Uložiť Layout</button>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-6 grid grid-cols-12 gap-8 h-[calc(100vh-80px)] overflow-hidden">
        {/* Sidebar */}
        <div className="col-span-3 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">SPELEO ŠABLÓNY</h2>
            <div className="grid grid-cols-2 gap-3">
              {THEME_TEMPLATES.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => applyTemplate(t)}
                  className="group flex flex-col items-center gap-2 p-2 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-center"
                >
                  <div className="w-full h-8 rounded-lg flex border border-slate-200 overflow-hidden shadow-sm">
                    <div className="flex-1" style={{ backgroundColor: t.bgColor }}></div>
                    <div className="flex-1" style={{ backgroundColor: t.fgColor }}></div>
                    <div className="w-1" style={{ backgroundColor: t.surveyColor }}></div>
                  </div>
                  <span className="text-[9px] font-black uppercase leading-tight tracking-tighter">{t.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white space-y-4">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">FARBY MAPY</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] uppercase font-black text-slate-500">Papier (BG)</label>
                <input type="color" value={settings.mapBgColor} onChange={e => setSettings(s => ({...s, mapBgColor: e.target.value}))} className="w-full h-10 rounded-xl cursor-pointer bg-slate-800 border-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] uppercase font-black text-slate-500">Chodba (FG)</label>
                <input type="color" value={settings.mapFgColor} onChange={e => setSettings(s => ({...s, mapFgColor: e.target.value}))} className="w-full h-10 rounded-xl cursor-pointer bg-slate-800 border-none" />
              </div>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-300">Polygon (Survey)</span>
                <input type="color" value={settings.surveyColor} onChange={e => setSettings(s => ({...s, surveyColor: e.target.value}))} className="w-8 h-8 rounded-full border-none cursor-pointer" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PARAMETRE EXPORTU</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Mierka 1:{settings.scale}</span>
                <input type="range" min="10" max="1000" step="10" value={settings.scale} onChange={e => setSettings(s => ({...s, scale: parseInt(e.target.value)}))} className="w-24 accent-blue-600" />
              </div>
              <select 
                value={settings.paperSize} 
                onChange={e => setSettings(s => ({...s, paperSize: e.target.value as any}))}
                className="w-full bg-slate-50 border rounded-xl px-4 py-2 text-xs font-black uppercase shadow-sm"
              >
                {Object.values(PaperSize).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </section>
        </div>

        {/* Content Area */}
        <div className="col-span-9 flex flex-col gap-6 overflow-hidden">
          <nav className="flex bg-slate-200/60 p-1 rounded-2xl w-fit self-center shadow-inner">
            {[
              { id: 'preview', label: 'Dizajn' },
              { id: 'header', label: 'Legenda' },
              { id: 'symbols', label: 'AI Kolorizér' },
              { id: 'extra', label: 'Moduly' },
              { id: 'code', label: 'Therion Kód' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-800'}`}>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-h-0 bg-white rounded-[48px] shadow-sm border border-slate-200 overflow-hidden relative flex flex-col">
            {activeTab === 'preview' && (
              <div className="flex-1 flex flex-col items-center justify-center p-20 relative transition-all duration-500" style={{ backgroundColor: settings.printMode ? '#ffffff' : settings.mapBgColor }}>
                <div className="w-[85%] h-[85%] border-4 border-slate-900 rounded-[100px] flex items-center justify-center shadow-inner relative overflow-hidden" style={{ backgroundColor: settings.printMode ? '#ffffff' : settings.mapFgColor, borderStyle: 'double' }}>
                  <div className="text-center select-none" style={{ color: previewTextColor, opacity: 0.15 }}>
                    <h2 className="text-6xl font-black uppercase tracking-tighter">{settings.caveName}</h2>
                    <p className="text-2xl font-bold mt-2">1:{settings.scale}</p>
                  </div>
                  {/* Fake survey line preview */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                    <path d="M 200,200 L 400,300 L 600,250 L 800,400" fill="none" stroke={settings.surveyColor} strokeWidth="4" strokeDasharray={settings.surveyStyle === 'dashed' ? '10 10' : settings.surveyStyle === 'dotted' ? '2 8' : '0'} />
                  </svg>
                </div>
                {/* Visual Legend Preview */}
                <div 
                  className={`absolute p-5 border-2 border-dashed border-blue-400 rounded-2xl text-[10px] font-black text-blue-600 shadow-2xl backdrop-blur-sm transition-all ${settings.headerBg ? 'bg-white/95' : 'bg-transparent'}`}
                  style={{ 
                    left: `${settings.headerX}%`, 
                    top: `${settings.headerY}%`, 
                    transform: settings.headerAnchor === 'center' ? 'translate(-50%, -50%)' : settings.headerAnchor === 'nw' ? 'translate(0, 0)' : settings.headerAnchor === 'ne' ? 'translate(-100%, 0)' : settings.headerAnchor === 'sw' ? 'translate(0, -100%)' : settings.headerAnchor === 'se' ? 'translate(-100%, -100%)' : settings.headerAnchor === 'n' ? 'translate(-50%, 0)' : settings.headerAnchor === 's' ? 'translate(-50%, -100%)' : settings.headerAnchor === 'w' ? 'translate(0, -50%)' : settings.headerAnchor === 'e' ? 'translate(-100%, -50%)' : '' 
                  }}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full mb-1 text-[8px]">{settings.headerAnchor.toUpperCase()}</span>
                    <span>LEGENDA</span>
                    {settings.logoPath && <div className="mt-2 w-12 h-12 bg-slate-200 flex items-center justify-center rounded-lg text-[6px] text-slate-500">LOGO</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'symbols' && (
              <div className="p-12 h-full overflow-y-auto custom-scrollbar flex flex-col gap-10">
                {Object.keys(settings.symbolOverrides).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[64px] p-20 text-center">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">⚠️</div>
                    <h2 className="text-xl font-black uppercase text-slate-800 mb-2">Žiadne symboly nenájdené</h2>
                    <p className="text-slate-500 max-w-sm mb-8">AI Kolorizér potrebuje zoznam symbolov. Nahrajte súbor <b>.th2</b>, aby ste mohli inteligentne upraviť farby.</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-3xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30"
                    >
                      NAHRAŤ .TH2 TERAZ
                    </button>
                  </div>
                ) : (
                  <section className="bg-slate-900 rounded-[40px] p-8 text-white relative shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                       <div>
                         <h2 className="text-2xl font-black uppercase tracking-tight">AI Kolorizér</h2>
                         <p className="text-slate-400 text-sm">Gemini AI navrhne farby symbolov ladené k vašej šablóne.</p>
                       </div>
                       <button 
                         onClick={analyzeColorsWithAI} 
                         disabled={aiLoading} 
                         className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase transition-all shadow-xl shadow-blue-600/30 flex items-center gap-2"
                       >
                         {aiLoading ? (
                           <><span className="animate-spin text-lg">⚙️</span> ANALYZUJEM...</>
                         ) : '✨ OPTIMALIZOVAŤ'}
                       </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {(Object.entries(settings.symbolOverrides) as [string, SymbolOverride][]).map(([type, override]) => (
                       <div key={type} className="p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[8px] font-black uppercase px-2 py-1 bg-white/10 rounded-lg text-slate-400">{override.category}</span>
                             <input type="checkbox" checked={override.visible} onChange={e => updateSymbolOverride(type, { visible: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                          </div>
                          <h3 className="text-[10px] font-black text-slate-200 mb-3 truncate" title={type}>{type}</h3>
                          <div className="flex items-center gap-3">
                             <input type="color" value={override.color || '#000000'} onChange={e => updateSymbolOverride(type, { color: e.target.value })} className="w-10 h-10 rounded-xl cursor-pointer shadow-sm border-none bg-transparent" />
                             <span className="text-[9px] font-mono text-slate-500 uppercase">{override.color}</span>
                          </div>
                       </div>
                     ))}
                   </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'header' && (
              <div className="p-12 h-full overflow-y-auto custom-scrollbar space-y-12">
                <section className="grid grid-cols-2 gap-16">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-slate-900 border-b pb-2 flex items-center gap-2">
                       <span className="w-2 h-2 bg-blue-500 rounded-full"></span> POZÍCIA A ŠTÝL LEGENDY
                    </h3>
                    <div className="aspect-[16/10] bg-slate-50 border-2 border-slate-200 rounded-[40px] grid grid-cols-3 grid-rows-3 gap-3 p-6 shadow-inner relative">
                      {ANCHORS.map(a => (
                        <button key={a.id} onClick={() => setSettings(s => ({...s, headerAnchor: a.id, headerX: a.x, headerY: a.y}))}
                          className={`rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-[9px] font-black uppercase ${settings.headerAnchor === a.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-300'}`}>
                          <span>{a.id}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-4 bg-slate-100 p-6 rounded-3xl">
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-slate-600">Legendy na mape (on)</span>
                         <input type="checkbox" checked={settings.showLegend} onChange={e => setSettings(s => ({...s, showLegend: e.target.checked}))} className="w-4 h-4 accent-blue-600" />
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-slate-600">Pozadie legendy (Transp)</span>
                         <input type="checkbox" checked={settings.headerBg} onChange={e => setSettings(s => ({...s, headerBg: e.target.checked}))} className="w-4 h-4 accent-blue-600" />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[9px] font-black uppercase text-slate-400">Šírka legendy (cm): {settings.legendWidth}</label>
                         <input type="range" min="10" max="150" value={settings.legendWidth} onChange={e => setSettings(s => ({...s, legendWidth: parseInt(e.target.value)}))} className="w-full accent-blue-600" />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[9px] font-black uppercase text-slate-400">Počet stĺpcov: {settings.legendColumns}</label>
                         <input type="range" min="1" max="10" value={settings.legendColumns} onChange={e => setSettings(s => ({...s, legendColumns: parseInt(e.target.value)}))} className="w-full accent-blue-600" />
                       </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <h3 className="text-xs font-black uppercase text-slate-900 border-b pb-2 flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> LOGO A METADÁTA
                    </h3>
                    <div className="grid gap-4">
                      <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-4 shadow-xl">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Cesta k logu (.jpg)</label>
                          <input type="text" value={settings.logoPath} onChange={e => setSettings(s => ({...s, logoPath: e.target.value}))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs outline-none font-bold" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Šírka loga (cm): {settings.logoWidth}</label>
                          <input type="range" min="1" max="10" step="0.5" value={settings.logoWidth} onChange={e => setSettings(s => ({...s, logoWidth: parseFloat(e.target.value)}))} className="w-full accent-blue-500" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Názov Jaskyne</label>
                        <input type="text" placeholder="Hacavská jaskyňa" value={settings.caveName} onChange={e => setSettings(s => ({...s, caveName: e.target.value}))} className="w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Meranie</label>
                          <input type="text" value={settings.topoTeam} onChange={e => setSettings(s => ({...s, topoTeam: e.target.value}))} className="w-full bg-slate-50 border rounded-xl px-4 py-2 text-xs font-medium shadow-sm outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Kartografia</label>
                          <input type="text" value={settings.cartoTeam} onChange={e => setSettings(s => ({...s, cartoTeam: e.target.value}))} className="w-full bg-slate-50 border rounded-xl px-4 py-2 text-xs font-medium shadow-sm outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'extra' && (
              <div className="p-12 h-full overflow-y-auto custom-scrollbar flex flex-col gap-12">
                <section className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
                  <h2 className="text-2xl font-black uppercase tracking-tight mb-8">Nový Metapost Modul</h2>
                  <div className="space-y-6 relative z-10">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Názov modulu (unifikovaný)</label>
                      <input type="text" placeholder="napr. l_slope_sk, p_stalagmite_red..." value={newModuleName} onChange={e => setNewModuleName(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Kód modulu (Metapost)</label>
                      <textarea placeholder="code metapost &#10;  def l_slope (expr P) = ... &#10;endcode" value={newModuleCode} onChange={e => setNewModuleCode(e.target.value)} className="w-full bg-black/30 border border-white/20 rounded-3xl px-6 py-4 text-xs font-mono min-h-[200px] outline-none leading-relaxed" />
                    </div>
                    <button onClick={addCustomModule} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30">
                      PRIDAŤ DO KNIŽNICE
                    </button>
                  </div>
                </section>

                <section className="space-y-8">
                  <h3 className="text-xs font-black uppercase text-slate-900 border-b pb-2 flex items-center justify-between">
                    <span>AKTÍVNA KNIŽNICA MODULOV</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-8">
                    {[...EXTRA_MODULES, ...settings.customModules].map(m => (
                      <div key={m.id} className={`p-8 rounded-[40px] border-2 transition-all flex flex-col justify-between ${settings.enabledModules.includes(m.id) ? 'border-blue-500 bg-blue-50/40 shadow-xl scale-[1.02]' : 'border-slate-100 bg-white shadow-sm'}`}>
                        <div className="mb-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                               <div className={`p-3 rounded-2xl ${settings.enabledModules.includes(m.id) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                  <span className="text-xl">🎨</span>
                               </div>
                               <div>
                                  <h3 className="font-black text-xs uppercase text-slate-800 tracking-wider">{m.nameSk}</h3>
                               </div>
                            </div>
                            <input type="checkbox" checked={settings.enabledModules.includes(m.id)} onChange={() => setSettings(s => ({...s, enabledModules: s.enabledModules.includes(m.id) ? s.enabledModules.filter(id => id !== m.id) : [...s.enabledModules, m.id]}))} className="w-6 h-6 accent-blue-600 cursor-pointer" />
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-4">{m.descriptionSk}</p>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${m.isCustom ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                             {m.isCustom ? 'Užívateľský' : 'Systémový'}
                           </span>
                           {m.isCustom && (
                             /* Fix: Added explicit parameter 'id' to the enabledModules.filter callback */
                             <button onClick={() => setSettings(s => ({...s, customModules: s.customModules.filter(x => x.id !== m.id), enabledModules: s.enabledModules.filter(id => id !== m.id)}))} className="text-[9px] font-black text-red-500 uppercase hover:underline transition-all underline-offset-4">Odstrániť</button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="flex-1 bg-[#0f172a] flex flex-col overflow-hidden">
                <div className="bg-slate-800/60 px-8 py-4 border-b border-slate-800 flex justify-between shrink-0">
                   <div className="flex gap-2">
                     <button onClick={() => setCodeTab('layout')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${codeTab === 'layout' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Layout.thl</button>
                     <button onClick={() => setCodeTab('config')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${codeTab === 'config' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Config.thcfg</button>
                   </div>
                   <button onClick={() => copyToClipboard(codeTab === 'layout' ? layoutFileContent : configFileContent)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all">
                    {copyFeedback ? 'SKOPÍROVANÉ ✅' : 'KOPÍROVAŤ 📋'}
                   </button>
                </div>
                <pre className="flex-1 p-12 text-emerald-400/90 font-mono text-[13px] overflow-auto custom-scrollbar leading-relaxed"><code>{codeTab === 'layout' ? layoutFileContent : configFileContent}</code></pre>
              </div>
            )}
          </div>
        </div>
      </main>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
    </div>
  );
};

export default App;
