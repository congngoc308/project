/**
 * Ảnh thật dùng trong giao diện (Wikimedia Commons). Ảnh đã được cắt khung 4:3, thu nhỏ và đổi sang WebP;
 * giấy phép CC BY-SA yêu cầu ghi công và giữ nguyên giấy phép cho bản đã chỉnh sửa.
 */
export interface Photo {
  src: string
  alt: string
  author: string
  license: string
  source: string
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`

export const DISH_PHOTOS: Record<string, Photo> = {
  PB: { src: "/img/mon-PB.webp", alt: "Tô phở bò với rau thơm", author: "Kritzolina", license: "CC BY-SA 4.0", source: commons("Phở bò in a German restaurant 02.jpg") },
  BX: { src: "/img/mon-BX.webp", alt: "Đĩa bò xào rau cải", author: "jules", license: "CC BY 2.0", source: commons("Ginger beef stir fry.jpg") },
  CC: { src: "/img/mon-CC.webp", alt: "Đĩa cơm chiên bò", author: "Fumikas Sagisavas", license: "CC0", source: commons("Cumin beef fried rice.jpg") },
  RX: { src: "/img/mon-RX.webp", alt: "Đĩa rau xào tỏi", author: "Andy Li", license: "CC0", source: commons("Morning Glory - Pho 2025-07-25.jpg") },
  TX: { src: "/img/mon-TX.webp", alt: "Đĩa tôm xào tỏi", author: "Jiaqian AirplaneFan", license: "CC BY 3.0", source: commons("Stir-fried shrimp with garlic and vinegar - panoramio.jpg") },
  GR: { src: "/img/mon-GR.webp", alt: "Đĩa gà rang ớt tỏi", author: "PattayaPatrol", license: "CC BY-SA 4.0", source: commons("DSC 9654 Crispy stir-fried chicken tossed in a spicy chili-garlic sauce with scallions and dried red chilies.jpg") },
}

export const KITCHEN_PHOTO: Photo = {
  src: "/img/bep-lua.webp",
  alt: "Hai chảo đang xào trên bếp lửa lớn",
  author: "romainguy",
  license: "CC BY-SA 2.0",
  source: commons("Wok cooking and fire by romainguy.jpg"),
}

export const ALL_PHOTOS: Photo[] = [KITCHEN_PHOTO, ...Object.values(DISH_PHOTOS)]
