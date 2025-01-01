// forDisplayingInput is used to allow user to type "-" at the end and not replace with empty space.
// For eg:- "test-slug" is the slug user wants to set but while typing "test-" would get replace to "test" becauser of replace(/-+$/, "")

export const slugify = (str: string, forDisplayingInput?: boolean) => {
  if (!str) {
    return "";
  }
  const cyrillicToLatinMap: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  const s = str
    .toLowerCase()
    .split("")
    .map((char) => cyrillicToLatinMap[char] || char)
    .join("")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9.\s]+/gu, "-")
    .replace(/[\s_#]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return forDisplayingInput ? s : s.replace(/-+$/, "").replace(/\.*$/, ""); // Remove dashes and period from end
};

export default slugify;
