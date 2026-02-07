
import { GeneratorSettings, ExportType, PaperSize, MetapostModule } from '../types';
import { EXTRA_MODULES } from '../constants';

const hexToTherionRgb = (hex: string): string => {
  if (!hex || !hex.startsWith('#')) return '[100 100 100]';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `[${Math.round((r / 255) * 100)} ${Math.round((g / 255) * 100)} ${Math.round((b / 255) * 100)}]`;
};

const hexToMpColor = (hex: string): string => {
  if (!hex || !hex.startsWith('#')) return '(0.0, 0.0, 0.0)';
  const r = (parseInt(hex.slice(1, 3), 16) / 255).toFixed(3);
  const g = (parseInt(hex.slice(3, 5), 16) / 255).toFixed(3);
  const b = (parseInt(hex.slice(5, 7), 16) / 255).toFixed(3);
  return `(${r}, ${g}, ${b})`;
};

export const generateLayoutFile = (settings: GeneratorSettings): string => {
  const allModules = [...EXTRA_MODULES, ...settings.customModules];
  const activeModules = allModules
    .filter(m => settings.enabledModules.includes(m.id))
    .map(m => m.code)
    .join('\n\n');

  const bg = settings.printMode ? '[100 100 100]' : hexToTherionRgb(settings.mapBgColor);
  const fg = hexToTherionRgb(settings.mapFgColor);

  let symbolDirectives = "";
  Object.entries(settings.symbolOverrides).forEach(([type, override]) => {
    const sSet = (override.symbolSet === 'DEFAULT' || !override.symbolSet) ? settings.defaultSymbolSet : override.symbolSet;
    if (sSet && sSet !== 'DEFAULT') {
      symbolDirectives += `  symbol-assign ${override.category} ${type} ${sSet}\n`;
    }
    if (override.color) {
      symbolDirectives += `  symbol-color ${override.category} ${type} ${hexToTherionRgb(override.color)}\n`;
    }
    if (!override.visible) {
      symbolDirectives += `  symbol-hide ${override.category} ${type}\n`;
    }
  });

  const logoTex = settings.logoPath 
    ? `\\vbox{\\externalfigure[${settings.logoPath}][width=${settings.logoWidth}cm]}\\vskip0.5cm` 
    : '';

  // Metapost pre Survey
  const surveyMp = settings.showSurvey ? `
  code metapost
    def l_survey_cave (expr P) =
      T:=identity;
      pair zz[];
      pickup PenC;
      for t = 0 upto length P - 1:
        zz1 := point t of P;
        zz2 := point t+1 of P;
        draw zz1 -- zz2 withcolor ${hexToMpColor(settings.surveyColor)} ${settings.surveyStyle === 'dashed' ? 'dashed evenly' : settings.surveyStyle === 'dotted' ? 'dashed withdots' : ''};
      endfor;
    enddef;
  endcode` : `  symbol-hide line survey`;

  return `encoding utf-8

layout custom_layout
  doc-author "${settings.author}"
  scale 1 ${settings.scale}
  language ${settings.language}
  
  color map-bg ${bg}
  color map-fg ${fg}

  symbol-set ${settings.defaultSymbolSet !== 'DEFAULT' ? settings.defaultSymbolSet : 'AUT'}

${symbolDirectives}

${surveyMp}

  rotate ${settings.rotation}
  transparency ${settings.transparency ? 'on' : 'off'}
  overlap ${settings.overlap} cm
  scale-bar ${settings.scaleBarLength} m

  map-header ${settings.headerX} ${settings.headerY} ${settings.headerAnchor}
  map-header-bg ${settings.headerBg ? 'on' : 'off'}
  legend ${settings.showLegend ? 'on' : 'off'}
  legend-width ${settings.legendWidth} cm
  legend-columns ${settings.legendColumns}

  # Custom TeX Legend
  code tex-map
    # Definicia potrebnych toks registrov
    \\newtoks\\topoteam \\newtoks\\cartoteam
    
    \\cavename={${settings.caveName}}
    \\comment={${settings.comment}}
    \\topoteam={${settings.topoTeam}}
    \\cartoteam={${settings.cartoTeam}}
    
    \\legendcontent={%
      \\hsize=\\legendwidth
      \\ifnortharrow\\vbox to 0pt{\\line{\\hfil\\northarrow}\\vss}\\fi
      
      ${logoTex}
      
      \\edef\\tmp{\\the\\cavename} \\ifx\\tmp\\empty \\else
        {\\size[${settings.caveNameFontSize}]\\the\\cavename} \\vskip1cm
      \\fi
      
      \\ifscalebar\\scalebar\\vskip1cm\\fi
      
      {\\ss
        \\edef\\tmp{\\the\\comment} \\ifx\\tmp\\empty \\else \\tmp \\vskip0.5cm \\fi
        {\\bf ${settings.exploTitle}:} ${settings.exploTeam} \\vskip0.2cm
        \\edef\\tmp{\\the\\topoteam} \\ifx\\tmp\\empty \\else {\\bf Meranie:} \\the\\topoteam \\vskip0.2cm \\fi
        \\edef\\tmp{\\the\\cartoteam} \\ifx\\tmp\\empty \\else {\\bf Kartografia:} \\the\\cartoteam \\vskip0.2cm \\fi
      }
      
      \\vskip1cm
      \\formattedlegend
    }
    
    \\framethickness=${settings.borderThickness}mm
  endcode

  ${settings.debugStationNames ? `debug station-names\n  code tex-map\n    \\def\\printstationlabel#1{\\size[${settings.stationLabelSize}]\\ss #1}\n  endcode` : ''}

${activeModules}

endlayout

layout ${settings.paperSize}_Layout
  ${settings.paperSize === PaperSize.A4 ? 'page-setup 21 29.7 19 27.7 1 1 cm' : 
    settings.paperSize === PaperSize.A3 ? 'page-setup 29.7 42 27.7 40 1 1 cm' : 
    settings.paperSize === PaperSize.A2 ? 'page-setup 42 59.4 40 57.4 1 1 cm' :
    'page-setup 59.4 84.1 56.4 81.1 1.5 1 cm'}
endlayout
`;
};

export const generateConfigFile = (settings: GeneratorSettings, layoutFileName: string): string => {
  const sources = settings.uploadedFiles.filter(f => f.type === 'th').map(f => `source ${f.fileName}`).join('\n');
  let tasks = '';
  settings.exportTypes.forEach(t => {
    if (t === ExportType.MAP) tasks += `export map -layout custom_layout -layout ${settings.paperSize}_Layout -o map.pdf\n`;
    if (t === ExportType.MODEL) tasks += `export model -o model.lox\n`;
  });

  return `encoding utf-8\n\n${sources || 'source main.th'}\n\nselect ${settings.selectName}\n\ninput ${layoutFileName}\n\n${tasks}`;
};
