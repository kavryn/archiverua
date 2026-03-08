export interface Archive {
  name: string;
  abbr: string;
  category: string;
}

export const ARCHIVES: Archive[] = [
  { name: "Центральний державний історичний архів України, м. Київ", abbr: "ЦДІАК", category: "Funds of Central State Historical Archives of Ukraine in Kyiv" },
  { name: "Центральний державний історичний архів України, м. Львів", abbr: "ЦДІАЛ", category: "Funds of The Central State Historical Archive in Lviv" },
  { name: "Центральний державний архів вищих органів влади та управління України", abbr: "ЦДАВО", category: "Funds of Central State Archives of Supreme Bodies of Power and Government of Ukraine" },
  { name: "Державний архів Вінницької області", abbr: "ДАВіО", category: "Funds of State Archive of Vinnytsia Oblast" },
  { name: "Державний архів Волинської області", abbr: "ДАВоО", category: "Funds of State Archive of Volyn Oblast" },
  { name: "Державний архів Дніпропетровської області", abbr: "ДАДнО", category: "Funds of State Archive of Dnipropetrovsk Oblast" },
  { name: "Державний архів Донецької області", abbr: "ДАДоО", category: "Funds of State Archive of Donetsk Oblast" },
  { name: "Державний архів Житомирської області", abbr: "ДАЖО", category: "Funds of State Archive of Zhytomyr Oblast" },
  { name: "Державний архів Закарпатської області", abbr: "ДАЗкО", category: "Funds of State Archive of Zakarpattia Oblast" },
  { name: "Державний архів Запорізької області", abbr: "ДАЗпО", category: "Funds of State Archive of Zaporizhzhya Oblast" },
  { name: "Державний архів Івано-Франківської області", abbr: "ДАІФО", category: "Funds of State Archive of Ivano-Frankivsk Oblast" },
  { name: "Державний архів Київської області", abbr: "ДАКО", category: "Funds of State Archive of Kyiv Oblast" },
  { name: "Державний архів міста Києва", abbr: "ДАК", category: "Funds of State Archive of Kyiv" },
  { name: "Державний архів Кіровоградської області", abbr: "ДАКрО", category: "Funds of State Archive of Kirovohrad Oblast" },
  { name: "Державний архів Луганської області", abbr: "ДАЛуО", category: "Funds of State Archive of Luhansk Oblast" },
  { name: "Державний архів Львівської області", abbr: "ДАЛО", category: "Funds of State Archive of Lviv Oblast" },
  { name: "Державний архів Миколаївської області", abbr: "ДАМО", category: "Funds of State Archive of Mykolaiv Oblast" },
  { name: "Державний архів Одеської області", abbr: "ДАОО", category: "Funds of State Archive of Odesa Oblast" },
  { name: "Державний архів Полтавської області", abbr: "ДАПО", category: "Funds of State Archive of Poltava Oblast" },
  { name: "Державний архів Рівненської області", abbr: "ДАРО", category: "Funds of State Archive of Rivne Oblast" },
  { name: "Державний архів Сумської області", abbr: "ДАСО", category: "Funds of State Archive of Sumy Oblast" },
  { name: "Державний архів Тернопільської області", abbr: "ДАТО", category: "Funds of State Archive of Ternopil Oblast" },
  { name: "Державний архів Харківської області", abbr: "ДАХО", category: "Funds of State Archive of Kharkiv Oblast" },
  { name: "Державний архів Херсонської області", abbr: "ДАХеО", category: "Funds of State Archive of Kherson Oblast" },
  { name: "Державний архів Хмельницької області", abbr: "ДАХмО", category: "Funds of State Archive of Khmelnytskyi Oblast" },
  { name: "Державний архів Черкаської області", abbr: "ДАЧкО", category: "Funds of State Archive of Cherkasy Oblast" },
  { name: "Державний архів Чернівецької області", abbr: "ДАЧвО", category: "Funds of State Archive of Chernivtsi Oblast" },
  { name: "Державний архів Чернігівської області", abbr: "ДАЧгО", category: "Funds of State Archive of Chernihiv Oblast" },
  { name: "Державний архів в Автономній Республіці Крим", abbr: "ДААРК", category: "Funds of State Archive in the Autonomous Republic of Crimea"}
];

export function filterArchives(query: string): Archive[] {
  const q = query.toLowerCase();
  return ARCHIVES.filter(
    (a) =>
      a.name.toLowerCase().includes(q) || a.abbr.toLowerCase().includes(q)
  );
}
