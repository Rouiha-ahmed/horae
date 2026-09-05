import Container from "@/components/Container";
import Title from "@/components/Title";
import React from "react";

const missionPoints = [
  "Des produits fiables et certifies",
  "Des conseils clairs et adaptes a vos besoins",
  "Une plateforme intuitive et moderne",
  "Un service client reactif et proche de vous",
];

const whyChoosePoints = [
  {
    title: "Authenticite garantie",
    description:
      "Tous nos produits proviennent de laboratoires certifies et de fournisseurs agrees.",
  },
  {
    title: "Large choix de produits",
    description:
      "Soins visage, corps, cheveux, hygiene, complements alimentaires, bebe, solaire et plus encore.",
  },
  {
    title: "Livraison rapide au Maroc",
    description:
      "Commandez en quelques clics et recevez vos produits rapidement, ou que vous soyez.",
  },
  {
    title: "Paiement securise et flexible",
    description:
      "Paiement a la livraison, paiement en ligne securise et avantages membres fideles.",
  },
  {
    title: "Programme de fidelite",
    description:
      "Cumulez des points et profitez de reductions exclusives avec la carte fidelite HORAE.",
  },
  {
    title: "Qualite et prix justes",
    description:
      "Nous selectionnons des references de qualite avec un excellent rapport qualite/prix.",
  },
];

const AboutPage = () => {
  return (
    <div className="horae-page pb-24">
      <section className="mx-3 mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_16%_0%,rgba(55,176,237,0.42),transparent_38%),linear-gradient(118deg,#0a456d,#02070d_68%)] text-[#edf7ff]">
        <Container className="flex min-h-[440px] flex-col justify-end py-14 md:min-h-[560px] md:py-20">
            <p className="horae-kicker text-shop_light_green">
              A propos de nous
            </p>
            <Title className="horae-display mt-6 max-w-5xl font-light uppercase text-[#edf7ff]">
              HORAE, le soin<br />dans le temps.
            </Title>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-white/52 md:text-base">
              HORAE est une parapharmacie en ligne basee au Maroc, dediee a
              votre beaute, votre sante et votre bien-etre au quotidien. Nous
              proposons une selection rigoureuse de produits authentiques issus
              de grandes marques reconnues.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/52 md:text-base">
              Pensee et developpee par des professionnels passionnes par la
              sante et le digital, HORAE allie expertise pharmaceutique et
              technologie moderne pour offrir une experience d&apos;achat simple,
              rapide et securisee.
            </p>
        </Container>
      </section>

      <Container>
        <div className="mx-auto max-w-6xl space-y-20 py-16 md:space-y-28 md:py-24">
          <section className="grid overflow-hidden rounded-[28px] border border-white/10 bg-[#071522]/62 lg:grid-cols-2 lg:divide-x lg:divide-white/10">
            <div className="p-7 md:p-10 lg:pl-0">
              <h2 className="font-editorial text-4xl font-light uppercase text-darkColor md:text-5xl">
                Notre mission
              </h2>
              <p className="mt-3 text-sm md:text-base text-gray-700 leading-7">
                Faciliter l&apos;acces aux meilleurs produits de parapharmacie au
                Maroc avec une approche fiable, claire et proche de vos besoins.
              </p>
              <ul className="mt-4 space-y-2.5 text-sm md:text-base text-gray-700">
                {missionPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-shop_dark_green shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-7 md:p-10 lg:pr-0">
              <h2 className="font-editorial text-4xl font-light uppercase text-darkColor md:text-5xl">
                Une parapharmacie pensee pour vous
              </h2>
              <p className="mt-3 text-sm md:text-base text-gray-700 leading-7">
                Chez HORAE, nous croyons que chacun merite un acces simple et
                equitable a des soins de qualite. Que ce soit pour une routine
                beaute, un besoin specifique ou une prevention quotidienne,
                notre application est concue pour repondre a vos exigences avec
                modernite et confiance.
              </p>
              <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
                Rejoignez la communaute HORAE et profitez d&apos;une experience
                d&apos;achat securisee, de produits authentiques et d&apos;un
                accompagnement professionnel a chaque etape.
              </p>
            </div>
          </section>

          <section className="space-y-8">
            <p className="horae-kicker text-shop_light_green">Nos engagements</p>
            <h2 className="font-editorial text-5xl font-light uppercase text-darkColor md:text-6xl">
              Pourquoi choisir HORAE ?
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {whyChoosePoints.map((item) => (
                <article
                  key={item.title}
                  className="h-full rounded-[24px] border border-white/10 bg-[#071522]/62 p-6 transition-all hover:-translate-y-1 hover:border-shop_light_green/55 md:p-8"
                >
                  <h3 className="font-editorial text-xl font-medium uppercase text-darkColor md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-700 leading-6">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
};

export default AboutPage;
