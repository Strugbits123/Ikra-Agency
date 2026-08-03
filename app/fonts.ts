import localFont from "next/font/local";

export const zalando = localFont({
  src: [
    {
      path: "../public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf",
      style: "normal",
      weight: "200 900",
    },
    {
      path: "../public/fonts/ZalandoSansSemiExpanded-Italic-VariableFont_wght.ttf",
      style: "italic",
      weight: "200 900",
    },
  ],
  variable: "--font-zalando",
  display: "swap",
});
