import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Manrope } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ServerActionRecovery from "@/components/ServerActionRecovery";

const sansFont = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const RootLayout = ({ children }: { children: import("react").ReactNode }) => {
  return (
    <html lang="fr">
      <body className={`${sansFont.variable} font-sans antialiased`}>
        <ClerkProvider>
          <ServerActionRecovery />
          {children}
          <Toaster
            position="bottom-right"
            gutter={8}
            toastOptions={{
              duration: 2800,
              style: {
                background: "#071522",
                color: "#EDF7FF",
                fontSize: "13px",
                fontWeight: "600",
                borderRadius: "16px",
                border: "1px solid rgba(197,226,245,0.14)",
                boxShadow: "0 18px 50px -26px rgba(27,143,205,0.65)",
                padding: "12px 16px",
                maxWidth: "320px",
              },
              success: {
                iconTheme: {
                  primary: "#38BDF8",
                  secondary: "#02101B",
                },
              },
              error: {
                iconTheme: {
                  primary: "#e11d48",
                  secondary: "#ffffff",
                },
                style: {
                  background: "#fff1f2",
                  color: "#9f1239",
                  border: "1px solid rgba(225,29,72,0.15)",
                },
              },
            }}
          />
        </ClerkProvider>
      </body>
    </html>
  );
};

export default RootLayout;
