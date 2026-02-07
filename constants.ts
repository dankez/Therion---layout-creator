
import { MetapostModule } from './types';

export interface ThemeTemplate {
  id: string;
  name: string;
  bgColor: string; // Papier / Pozadie (Very light)
  fgColor: string; // Výplň chodieb (Subtle tint)
  surveyColor: string; // Polygon (Contrast)
  description: string;
}

export const THEME_TEMPLATES: ThemeTemplate[] = [
  { 
    id: 'natural_earth', 
    name: 'Prírodná Zem', 
    bgColor: '#fdfcf9', 
    fgColor: '#f7f4eb', 
    surveyColor: '#4a3728',
    description: 'Veľmi svetlý prírodný papier s hnedým polygónom.'
  },
  { 
    id: 'pastel_brown', 
    name: 'Pastelová Hnedá', 
    bgColor: '#fcfaf9', 
    fgColor: '#f5f0ed', 
    surveyColor: '#5d4037',
    description: 'Jemný krémový papier pre vápencové jaskyne.'
  },
  { 
    id: 'pastel_gray', 
    name: 'Pastelová Sivá', 
    bgColor: '#fafafa', 
    fgColor: '#f2f2f2', 
    surveyColor: '#212121',
    description: 'Neutrálny svetlosivý vzhľad pre technickú dokumentáciu.'
  },
  { 
    id: 'pastel_green', 
    name: 'Pastelová Zelená', 
    bgColor: '#f9fbf7', 
    fgColor: '#f1f6eb', 
    surveyColor: '#2e7d32',
    description: 'Svieži svetlozelený nádych pre krasové oblasti.'
  },
  { 
    id: 'hc_brown', 
    name: 'HC Hnedá', 
    bgColor: '#fdfbfb', 
    fgColor: '#f4ecea', 
    surveyColor: '#3e2723',
    description: 'Vysoký kontrast tmavej hnedej na takmer bielom papieri.'
  },
  { 
    id: 'hc_gray', 
    name: 'HC Sivá', 
    bgColor: '#f8f9fa', 
    fgColor: '#e9ecef', 
    surveyColor: '#000000',
    description: 'Čistý biely papier s antracitovými prvkami.'
  },
  { 
    id: 'heatmap', 
    name: 'HC Heatmap', 
    bgColor: '#fffcfc', 
    fgColor: '#fbe9e7', 
    surveyColor: '#d84315',
    description: 'Svetlý papier s výrazným oranžovo-červeným polygónom.'
  },
  { 
    id: 'blueprint_light', 
    name: 'Technický Blankyt', 
    bgColor: '#f7faff', 
    fgColor: '#e3f2fd', 
    surveyColor: '#0d47a1',
    description: 'Jemne modrastý papier pre technicky ladené mapy.'
  }
];

export const EXTRA_MODULES: MetapostModule[] = [
  {
    id: 'l_section_marker',
    nameSk: 'Značka rezu (Section)',
    descriptionSk: 'Štandardizovaná značka pre líniu rezu s písmenami.',
    category: 'metapost',
    code: `code metapost
def l_section (expr P) =
  T:=identity;
  pickup pencircle scaled 0.5bp;
  draw P withcolor (0.5, 0, 0.5);
  pair p_start, p_end;
  p_start := point 0 of P;
  p_end := point (length P) of P;
  draw (p_start + (5pt,0)) -- (p_start - (5pt,0)) rotated (angle(direction 0 of P)) shifted p_start withcolor (0.5, 0, 0.5);
  draw (p_end + (5pt,0)) -- (p_end - (5pt,0)) rotated (angle(direction (length P) of P)) shifted p_end withcolor (0.5, 0, 0.5);
enddef;
endcode`
  },
  {
    id: 'a_sand_wiki',
    nameSk: 'Piesok (Jemný vzor)',
    descriptionSk: 'Náhodne rozložené body pre realistické znázornenie piesku.',
    category: 'metapost',
    code: `code metapost
def a_sand (expr p) =
  T:=identity;
  pickup pencircle scaled 0.1bp;
  path q; q = bbox p;
  picture tmp_pic;
  tmp_pic := image(
    for i = xpart llcorner q step 0.15u until xpart urcorner q:
      for j = ypart llcorner q step 0.15u until ypart urcorner q:
        draw origin shifted ((i,j) randomized 0.12u) withpen pencircle scaled 0.1bp;
      endfor;
    endfor;
  );
  clip tmp_pic to p;
  draw tmp_pic withcolor (0.5, 0.4, 0.2);
enddef;
endcode`
  },
  {
    id: 'l_u_flowstone_wiki',
    nameSk: 'Sintrovaná stena',
    descriptionSk: 'Vykreslí "zúbkovanú" líniu pre sintrom pokryté steny.',
    category: 'metapost',
    code: `code metapost
def l_u_flowstone (expr P) =
  T:=identity;
  pickup pencircle scaled 0.5bp;
  path Q; Q := P;
  for i=0 step 0.2u until (arclength P):
    pair p_at, d_at;
    p_at := point (arctime i of P) of P;
    d_at := unitvector(direction (arctime i of P) of P) rotated 90;
    draw p_at -- (p_at + d_at * 0.15u) withcolor (0.7, 0.5, 0.2);
  endfor;
  draw P withcolor (0.7, 0.5, 0.2);
enddef;
endcode`
  }
];
