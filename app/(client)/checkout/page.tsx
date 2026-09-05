"use client";

import { createCMIPayment } from "@/actions/createCMIPayment";
import { createManualOrder } from "@/actions/createManualOrder";
import Container from "@/components/Container";
import NoAccess from "@/components/NoAccess";
import PriceFormatter from "@/components/PriceFormatter";
import { urlFor } from "@/lib/image";
import { Address } from "@/types";
import useStore from "@/store";
import { useAuth } from "@clerk/nextjs";
import {
  BookmarkCheck,
  CreditCard,
  HandCoins,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import toast from "react-hot-toast";

type PaymentMethod = "cod" | "cmi_card";
type ShippingZone = "casa" | "other";

const SHIPPING: Record<ShippingZone, { cost: number; freeFrom: number }> = {
  casa:  { cost: 20,  freeFrom: 249 },
  other: { cost: 50,  freeFrom: 499 },
};

const cmiEnabled = process.env.NEXT_PUBLIC_ENABLE_CMI === "true";

type AddressForm = {
  pays: string;
  prenom: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
};

const emptyForm: AddressForm = {
  pays: "Maroc",
  prenom: "",
  nom: "",
  adresse: "",
  codePostal: "",
  ville: "",
  telephone: "",
};

/** Split "Prénom Nom" → { prenom, nom } */
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { prenom: parts[0] || "", nom: parts.slice(1).join(" ") };
};

export default function CheckoutPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const hasHydrated   = useStore((s) => s.hasHydrated);
  const groupedItems  = useStore((s) => s.getGroupedItems());
  const getTotalPrice = useStore((s) => s.getTotalPrice);
  const getItemCount  = useStore((s) => s.getItemCount);
  const resetCart     = useStore((s) => s.resetCart);

  const safeItems = hasHydrated ? groupedItems : [];

  const [loading,        setLoading]        = useState(false);
  const [form,           setForm]           = useState<AddressForm>(emptyForm);
  const [zone,           setZone]           = useState<ShippingZone>("casa");
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>("cod");
  const [promoCode,      setPromoCode]      = useState("");
  const [promoState,     setPromoState]     = useState<{
    valid: boolean; message?: string; discountAmount: number;
  } | null>(null);
  const [saveAddress,    setSaveAddress]    = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);

  const subtotal     = hasHydrated ? getTotalPrice() : 0;
  const shipping     = SHIPPING[zone];
  const shippingCost = subtotal >= shipping.freeFrom ? 0 : shipping.cost;
  const promoOff     = promoState?.valid ? promoState.discountAmount : 0;
  const total        = Math.max(0, subtotal + shippingCost - promoOff);

  /* ── Fetch saved addresses on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/addresses", { cache: "no-store" });
        if (!res.ok) return;
        const data: Address[] = await res.json();
        setSavedAddresses(data);
        const def = data.find((a) => a.default) || data[0];
        if (def) {
          const { prenom, nom } = splitName(def.name);
          setForm({
            pays:       def.state   || "Maroc",
            prenom,
            nom,
            adresse:    def.address,
            codePostal: def.zip     || "",
            ville:      def.city,
            telephone:  def.phone   || "",
          });
        }
      } catch {
        // silent
      }
    })();
  }, []);

  /* ── Redirect if cart empty ── */
  useEffect(() => {
    if (hasHydrated && safeItems.length === 0) router.replace("/cart");
  }, [hasHydrated, safeItems.length, router]);

  /* ── Helpers ── */
  const fieldChange = (key: keyof AddressForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const prefillFrom = (addr: Address) => {
    const { prenom, nom } = splitName(addr.name);
    setForm({
      pays:       addr.state  || "Maroc",
      prenom,
      nom,
      adresse:    addr.address,
      codePostal: addr.zip    || "",
      ville:      addr.city,
      telephone:  (addr as Address & { phone?: string }).phone || "",
    });
  };

  const formValid = !!(
    form.prenom.trim() &&
    form.nom.trim() &&
    form.adresse.trim() &&
    form.ville.trim() &&
    form.telephone.trim()
  );

  /* ── Promo ── */
  const applyPromo = async () => {
    if (!promoCode.trim()) { toast.error("Veuillez saisir un code promo"); return; }
    try {
      setLoading(true);
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, subtotal, paymentMethod }),
      });
      const data = await res.json();
      setPromoState(data);
      if (data.valid) {
        toast.success("Code promo appliqué");
      } else {
        toast.error(data.message || "Code promo invalide");
      }
    } catch { toast.error("Erreur lors de la validation"); }
    finally { setLoading(false); }
  };

  /* ── Save address to Address table (silent) ── */
  const persistAddress = async () => {
    try {
      await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    `${form.prenom.trim()} ${form.nom.trim()}`,
          address: form.adresse.trim(),
          city:    form.ville.trim(),
          phone:   form.telephone.trim(),
          state:   form.pays.trim() || "Maroc",
          zip:     form.codePostal.trim() || "00000",
          default: false,
        }),
      });
    } catch {
      // silent — address save is optional
    }
  };

  /* ── Checkout ── */
  const handleCheckout = async () => {
    if (!formValid) {
      toast.error("Veuillez remplir toutes les informations de livraison");
      return;
    }
    setLoading(true);
    try {
      const address = {
        _id:     crypto.randomUUID(),
        name:    `${form.prenom.trim()} ${form.nom.trim()}`,
        address: form.adresse.trim(),
        city:    form.ville.trim(),
        state:   form.pays.trim(),
        zip:     form.codePostal.trim(),
        phone:   form.telephone.trim(),
        default: false,
      };

      const orderNumber = crypto.randomUUID();

      if (paymentMethod === "cod") {
        const order = await createManualOrder({
          items:         safeItems,
          address,
          paymentMethod: "cod",
          promoCode:     promoState?.valid ? promoCode.trim().toUpperCase() : undefined,
        });
        if (saveAddress) await persistAddress();
        resetCart();
        toast.success("Commande confirmée — paiement à la livraison");
        window.location.href = `/success?orderNumber=${order.orderNumber}`;
        return;
      }

      // CMI card payment — create pending order then POST form to CMI gateway
      const { formParams, gatewayUrl } = await createCMIPayment({
        items:       safeItems,
        address,
        orderNumber,
        promoCode:   promoState?.valid ? promoCode.trim().toUpperCase() : undefined,
      });

      if (saveAddress) await persistAddress();
      resetCart();

      // Build a hidden form and submit it to CMI (browser navigates to CMI page)
      const cmiForm = document.createElement("form");
      cmiForm.method = "POST";
      cmiForm.action = gatewayUrl;
      cmiForm.style.display = "none";
      for (const [key, value] of Object.entries(formParams)) {
        const hiddenInput = document.createElement("input");
        hiddenInput.type  = "hidden";
        hiddenInput.name  = key;
        hiddenInput.value = value;
        cmiForm.appendChild(hiddenInput);
      }
      document.body.appendChild(cmiForm);
      cmiForm.submit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du paiement");
    } finally {
      setLoading(false);
    }
  };

  /* ── Guards ── */
  if (!isSignedIn) return <NoAccess />;

  if (!hasHydrated) {
    return (
      <div className="horae-page">
        <Container>
          <div className="grid gap-6 py-10 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
            </div>
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </Container>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="horae-page pb-24">
      <Container>
        <div className="border-b border-white/10 pb-8 pt-12 md:pb-10 md:pt-16">
          <p className="horae-kicker text-shop_light_green">Dernière étape</p>
          <h1 className="font-editorial mt-3 text-5xl font-light uppercase tracking-[-0.055em] md:text-7xl">
            Votre commande.
          </h1>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 py-6 text-xs text-lightColor">
          <Link
            href="/cart"
            className="underline underline-offset-2 hover:text-shop_btn_dark_green"
          >
            Panier
          </Link>
          <span>/</span>
          <span className="font-semibold text-shop_btn_dark_green">
            Finaliser la commande
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ══ LEFT ══ */}
          <div className="space-y-5 lg:col-span-2">

            {/* ── 1. Informations de livraison ── */}
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/70">
              <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
                <MapPin size={15} className="text-shop_light_green" />
                <h2 className="text-sm font-bold text-shop_btn_dark_green">
                  Informations de livraison
                </h2>
              </div>

              <div className="p-5">
                {/* Saved address chips */}
                {savedAddresses.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                      Adresses enregistrées
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr._id}
                          onClick={() => prefillFrom(addr)}
                          className="border border-shop_light_green/35 px-3 py-1.5 text-xs font-medium text-shop_dark_green transition hover:border-shop_btn_dark_green"
                        >
                          {addr.name} — {addr.city}
                        </button>
                      ))}
                    </div>
                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[11px] text-lightColor">ou remplissez le formulaire</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Pays / Région */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                      Pays / Région
                    </label>
                    <select
                      value={form.pays}
                      onChange={fieldChange("pays")}
                      className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                    >
                      <option value="Maroc">Maroc</option>
                    </select>
                  </div>

                  {/* Prénom / Nom */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                        Prénom
                      </label>
                      <input
                        value={form.prenom}
                        onChange={fieldChange("prenom")}
                        placeholder="Prénom"
                        className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                        Nom
                      </label>
                      <input
                        value={form.nom}
                        onChange={fieldChange("nom")}
                        placeholder="Nom de famille"
                        className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                      />
                    </div>
                  </div>

                  {/* Adresse */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                      Adresse
                    </label>
                    <input
                      value={form.adresse}
                      onChange={fieldChange("adresse")}
                      placeholder="Numéro et nom de rue, appartement…"
                      className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                    />
                  </div>

                  {/* Code postal + Ville */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                        Code postal{" "}
                        <span className="font-normal normal-case text-lightColor/60">
                          (facultatif)
                        </span>
                      </label>
                      <input
                        value={form.codePostal}
                        onChange={fieldChange("codePostal")}
                        placeholder="Ex : 20000"
                        className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                        Ville
                      </label>
                      <input
                        value={form.ville}
                        onChange={fieldChange("ville")}
                        placeholder="Ex : Casablanca"
                        className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                      />
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-lightColor">
                      Téléphone
                    </label>
                    <input
                      value={form.telephone}
                      onChange={fieldChange("telephone")}
                      placeholder="Ex : +212 6 00 00 00 00"
                      type="tel"
                      className="w-full rounded-none border border-black/15 bg-transparent px-4 py-2.5 text-sm text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                    />
                  </div>

                  {/* Save address checkbox */}
                  <label className="flex cursor-pointer items-center gap-2.5 pt-1">
                    <div
                      onClick={() => setSaveAddress((v) => !v)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                        saveAddress
                          ? "border-shop_light_green bg-shop_btn_dark_green"
                          : "border-white/20 hover:border-shop_light_green"
                      }`}
                    >
                      {saveAddress && (
                        <svg
                          viewBox="0 0 10 8"
                          className="h-3 w-3 stroke-white stroke-2 fill-none"
                        >
                          <polyline points="1,4 3.5,6.5 9,1" />
                        </svg>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-lightColor">
                      <BookmarkCheck size={13} className="text-shop_light_green" />
                      Mémoriser cette adresse pour mes prochaines commandes
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* ── 2. Mode d'expédition ── */}
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/70">
              <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
                <Truck size={15} className="text-shop_light_green" />
                <h2 className="text-sm font-bold text-shop_btn_dark_green">
                  Mode d&apos;expédition
                </h2>
              </div>

              <div className="space-y-3 p-5">
                {(
                  [
                    { value: "casa"  as ShippingZone, label: "Casablanca et Mohammedia", freeFrom: 249, cost: 20 },
                    { value: "other" as ShippingZone, label: "Autres Villes",             freeFrom: 499, cost: 50 },
                  ] as const
                ).map(({ value, label, freeFrom, cost }) => {
                  const isFree      = subtotal >= freeFrom;
                  const isSelected  = zone === value;
                  const priceLabel  = isFree ? "Gratuit" : `${cost},00 MAD`;

                  return (
                    <button
                      key={value}
                      onClick={() => setZone(value)}
                      className={`flex w-full items-center gap-4 border p-4 text-left transition ${
                        isSelected
                          ? "border-shop_btn_dark_green bg-shop_btn_dark_green/5"
                          : "border-white/12 hover:border-shop_light_green/50"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-shop_light_green" : "border-white/20"
                        }`}
                      >
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-shop_btn_dark_green" />
                        )}
                      </div>
                      <Package
                        size={17}
                        className={isSelected ? "text-shop_btn_dark_green" : "text-lightColor"}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-shop_dark_green">{label}</p>
                        <p className="text-xs text-lightColor">
                          Gratuite à partir de {freeFrom} dh
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          isFree ? "text-shop_light_green" : "text-shop_btn_dark_green"
                        }`}
                      >
                        {priceLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── 3. Paiement ── */}
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/70">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <CreditCard size={15} className="text-shop_light_green" />
                  <h2 className="text-sm font-bold text-shop_btn_dark_green">Paiement</h2>
                </div>
                <span className="text-[11px] text-lightColor">
                  Transactions sécurisées et chiffrées
                </span>
              </div>

              <div className="space-y-3 p-5">
                {(
                  [
                    ...(cmiEnabled
                      ? [{
                      value:  "cmi_card" as PaymentMethod,
                      label:  "Paiement par carte bancaire via CMI",
                      desc:   "Vous serez redirigé vers la plateforme sécurisée CMI (Centre Monétique Interbancaire) pour finaliser votre achat.",
                      Icon:   CreditCard,
                      badges: ["VISA", "MC", "CMI"],
                      }]
                      : []),
                    {
                      value:  "cod" as PaymentMethod,
                      label:  "Paiement à la livraison",
                      desc:   "Payez en espèces à la réception de votre colis.",
                      Icon:   HandCoins,
                      badges: [] as string[],
                    },
                  ] as const
                ).map(({ value, label, desc, Icon, badges }) => {
                  const isSelected = paymentMethod === value;
                  return (
                    <div key={value}>
                      <button
                        onClick={() => setPaymentMethod(value)}
                        className={`flex w-full items-center gap-4 border p-4 text-left transition ${
                          isSelected
                            ? "border-shop_btn_dark_green bg-shop_btn_dark_green/5"
                            : "border-white/12 hover:border-shop_light_green/50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected ? "border-shop_light_green" : "border-white/20"
                          }`}
                        >
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-shop_btn_dark_green" />
                          )}
                        </div>
                        <Icon
                          size={17}
                          className={isSelected ? "text-shop_btn_dark_green" : "text-lightColor"}
                        />
                        <span className="flex-1 text-sm font-semibold text-shop_dark_green">
                          {label}
                        </span>
                        {badges.length > 0 && (
                          <div className="flex gap-1">
                            {badges.map((b) => (
                              <span
                                key={b}
                                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      {isSelected && (
                        <p className="mt-1.5 border-l border-shop_light_green bg-black/[0.03] px-4 py-3 text-xs text-lightColor">
                          {desc}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ══ RIGHT — Order summary ══ */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/78 backdrop-blur-xl">

              {/* Products */}
              <div className="border-b border-slate-100 p-5">
                <h2 className="mb-4 text-sm font-bold text-shop_btn_dark_green">
                  Votre commande
                </h2>
                <div className="space-y-4">
                  {safeItems.map(({ product, quantity }) => {
                    const qty = quantity ?? getItemCount(product?._id);
                    return (
                      <div key={product?._id} className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {product?.images?.[0] && (
                            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#050e17]">
                              <Image
                                src={urlFor(product.images[0]).url()}
                                alt={product?.name || "Produit"}
                                width={200}
                                height={200}
                                className="h-14 w-14 object-contain p-1"
                              />
                            </div>
                          )}
                          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-shop_btn_dark_green text-[10px] font-bold text-white">
                            {qty}
                          </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="line-clamp-2 text-xs font-medium text-shop_dark_green">
                            {product?.name}
                          </p>
                        </div>
                        <PriceFormatter
                          amount={(product?.price as number) * qty}
                          className="shrink-0 text-xs font-semibold text-shop_dark_green"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Promo */}
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    placeholder="Code de réduction ou carte-cadeau"
                    className="flex-1 rounded-none border border-black/15 bg-transparent px-3 py-2 text-xs text-shop_dark_green outline-none placeholder:text-black/25 focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={loading}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-shop_dark_green hover:border-shop_light_green disabled:opacity-60"
                  >
                    Valider
                  </button>
                </div>
                {promoState && (
                  <p
                    className={`mt-1.5 text-[11px] ${
                      promoState.valid ? "text-shop_light_green" : "text-red-500"
                    }`}
                  >
                    {promoState.valid
                      ? `Remise appliquée : −${promoState.discountAmount.toFixed(2)} MAD`
                      : promoState.message || "Code invalide"}
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2.5 px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-lightColor">Sous-total</span>
                  <PriceFormatter
                    amount={subtotal}
                    className="font-medium text-shop_dark_green"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-lightColor">Expédition</span>
                  {shippingCost === 0 ? (
                    <span className="font-semibold text-shop_light_green">Gratuit</span>
                  ) : (
                    <span className="font-medium text-shop_dark_green">
                      {shippingCost.toFixed(2)} MAD
                    </span>
                  )}
                </div>
                {promoState?.valid && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-lightColor">Réduction</span>
                    <span className="font-semibold text-shop_light_green">
                      −{promoOff.toFixed(2)} MAD
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-shop_btn_dark_green">Total</span>
                    <span className="text-base font-bold text-shop_btn_dark_green">
                      {total.toFixed(2)} MAD
                    </span>
                  </div>
                  {shippingCost === 0 && (
                    <p className="mt-0.5 text-right text-[11px] text-shop_light_green">
                      Livraison offerte sur cette commande
                    </p>
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <button
                  onClick={handleCheckout}
                  disabled={loading || !formValid}
                  className="horae-button w-full py-3.5 disabled:opacity-60"
                >
                  {loading
                    ? "Traitement en cours…"
                    : paymentMethod === "cod"
                    ? "Confirmer la commande"
                    : "Payer maintenant"}
                </button>
                {!formValid && (
                  <p className="mt-2 text-center text-[11px] text-lightColor">
                    Remplissez les informations de livraison pour continuer
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
