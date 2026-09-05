"use client";

import { FormEvent, useState } from "react";

import { Loader2 } from "lucide-react";

type HomeNewsletterProps = {
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  successMessage: string;
  errorMessage: string;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

export default function HomeNewsletter({
  title,
  description,
  placeholder,
  buttonLabel,
  successMessage,
  errorMessage,
}: HomeNewsletterProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setStatus("error");
      setFeedback("Merci de saisir une adresse e-mail valide.");
      return;
    }

    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed newsletter subscription: ${response.status}`);
      }

      setStatus("success");
      setEmail("");
      setFeedback(successMessage);
    } catch (error) {
      console.error("Failed newsletter subscription:", error);
      setStatus("error");
      setFeedback(errorMessage);
    }
  };

  return (
    <section
      id="newsletter"
      className="scroll-mt-28 rounded-[28px] border border-white/10 bg-[#071522]/65 px-6 py-10 md:px-10 md:py-14"
    >
      <div className="grid items-end gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="horae-kicker mb-3 text-shop_light_green">Journal privé</p>
          <h2 className="font-editorial text-[clamp(2.35rem,5vw,4.4rem)] font-light uppercase leading-[0.94] tracking-[-0.055em] text-shop_dark_green">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-lightColor">
            {description}
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor="newsletter-email">
            Adresse e-mail
          </label>
          <input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== "idle") {
                setStatus("idle");
                setFeedback("");
              }
            }}
            required
            placeholder={placeholder}
            className="h-12 w-full rounded-full border border-white/12 bg-white/[0.035] px-5 text-sm text-darkColor outline-none transition placeholder:text-white/28 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/15"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="horae-button h-12 disabled:pointer-events-none disabled:opacity-70"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              buttonLabel
            )}
          </button>
          {feedback ? (
            <p
              role="status"
              className={`text-xs sm:col-span-2 ${status === "success" ? "text-emerald-700" : "text-rose-700"}`}
            >
              {feedback}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
