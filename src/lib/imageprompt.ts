/**
 * Image prompt engine.
 *
 * Builds a brief for a photographer, picture editor or image tool. It deliberately steers away from generic "AI imagery"
 * and always prefers real, official or licensed photography for real products and events. The brief is stored with the
 * image record; generated art must be labelled ILLUSTRATION or CONCEPTUAL.
 */
export interface ImageBriefInput {
  title: string;
  category: string;
  classification: string;
  company?: string;
  product?: string;
  topic?: string;
}

const SCENES: { match: RegExp; scene: string }[] = [
  { match: /data cent|gpu|accelerator|ai (?:hardware|infrastructure)|server|rack|cooling/i, scene: "modern data-center hall, high-density rack hardware with cabling and cold-aisle containment, realistic server-room environment" },
  { match: /chip|semiconductor|fab|wafer|lithograph|tsmc|foundry|silicon/i, scene: "semiconductor manufacturing: cleanroom tooling or close-up of a silicon wafer, realistic industrial lighting" },
  { match: /cyber|vulnerab|breach|ransomware|exploit|patch|cve|malware/i, scene: "restrained editorial still life of network equipment and a locked-down workstation, shallow depth of field, no code on screens" },
  { match: /robot|humanoid|autonom|drone/i, scene: "documentary-style photograph of a real robotics lab or test environment, practical lighting, hardware in focus" },
  { match: /quantum/i, scene: "close-up of cryogenic laboratory hardware, brushed metal and cabling, natural laboratory lighting" },
  { match: /phone|smartphone|laptop|device|display|wearable|headset|vr|ar\b|xr/i, scene: "clean product photograph on a neutral surface, soft studio light, accurate materials, nothing on the screen but plain colour" },
  { match: /developer|open source|github|api|programming|framework|software|devops/i, scene: "developer workspace photograph, desk with laptop and external monitor angled away from the lens, natural window light" },
  { match: /game|unreal|unity|render|vfx|houdini|cg\b|digital human|animation/i, scene: "editorial photograph of a visual-effects workstation and calibrated monitor, dim studio environment, no recognisable footage" },
  { match: /5g|6g|telecom|network|fiber|satellite|tower/i, scene: "telecommunications infrastructure at dusk, antenna tower or fibre closure, wide editorial composition" },
  { match: /space|rocket|launch|orbit/i, scene: "documentary-style photograph of launch-site infrastructure or ground equipment, realistic atmosphere" },
  { match: /ev\b|electric vehicle|battery|charging/i, scene: "editorial photograph of a charging station or battery-pack assembly, realistic environment" },
  { match: /regulat|policy|law|court|antitrust|government|senate|commission/i, scene: "architectural photograph of a government or courthouse exterior, neutral overcast light" },
  { match: /fund|acqui|startup|raise|valuation|ipo/i, scene: "contemporary office building exterior or a quiet shared workspace, documentary photographic style, no signage legible" },
];

export function buildImageBrief(i: ImageBriefInput): { prompt: string; recommendedKind: string; guidance: string[] } {
  const hay = `${i.title} ${i.topic ?? ""} ${i.category}`;
  const scene = SCENES.find((s) => s.match.test(hay))?.scene ?? "abstract editorial still life built from real technology materials (metal, glass, cable), minimal composition";
  const realProduct = !!(i.company || i.product);
  const parts = [
    `Editorial technology photograph for a story headlined "${i.title}".`,
    scene + ".",
    i.company ? `Subject relates to ${i.company}${i.product ? ` ${i.product}` : ""}; do not depict logos or invent product designs.` : "",
    "Subtle natural or cinematic lighting, realistic materials, premium technology-journalism photography.",
    "No text, no fictional logos, no fake screenshots, no neon, no glowing holograms, no floating circuit boards, no humanoid faces.",
  ].filter(Boolean);
  const guidance = [
    realProduct
      ? "A real product or company is the subject: use an official press image or a properly licensed photograph first. Only fall back to a conceptual image if none is available, and label it."
      : "No specific product is named: a licensed stock photograph or a restrained conceptual illustration is acceptable.",
    "Any generated image must be recorded as ILLUSTRATION or CONCEPTUAL and must never be presented as a photograph of a real event, person, lab or prototype.",
    i.classification === "RUMOR" || i.classification === "REPORT"
      ? "Do not depict the rumoured product. Use a neutral, non-product visual."
      : "Caption should state what the image shows and its credit.",
  ];
  return { prompt: parts.join(" "), recommendedKind: realProduct ? "PHOTO_OFFICIAL" : "PHOTO_LICENSED", guidance };
}
