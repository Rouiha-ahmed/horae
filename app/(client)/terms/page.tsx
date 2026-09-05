import Container from "@/components/Container";
import Title from "@/components/Title";
import React from "react";

const cgvArticles = [
  {
    title: "Article 1 - Tarifs",
    content: [
      "Les prix affiches sur le site sont exprimes en Dirham Marocain (MAD), toutes taxes comprises (TTC), incluant la TVA applicable au taux legal en vigueur au jour de la commande.",
      "Les frais de livraison applicables sont indiques lors de la validation de la commande et detailles dans le recapitulatif avant paiement. Ces frais peuvent varier selon le mode de livraison choisi, le poids et/ou la destination des produits.",
      "Nous nous reservons le droit de modifier nos prix a tout moment, sans preavis. Toutefois, les produits seront factures sur la base des tarifs en vigueur au moment de la validation de la commande, sous reserve de disponibilite.",
      "Toutes les offres de produits sont valables dans la limite des stocks disponibles. Pour les articles non stockes dans nos entrepots, leur disponibilite depend de nos fournisseurs. En cas d'indisponibilite apres la passation de commande, nous nous engageons a vous en informer dans les meilleurs delais par e-mail ou par telephone.",
    ],
    list: [
      "Accepter une commande partielle",
      "Demander un article equivalent ou un produit de remplacement",
      "Obtenir un remboursement ou un avoir valable sur le site",
    ],
  },
  {
    title: "Article 2 - Commande",
    content: [
      "En passant commande sur notre site, le client declare avoir au moins 18 ans et etre juridiquement capable de contracter.",
      "La validation de la commande vaut acceptation sans reserve des presentes Conditions Generales de Vente.",
    ],
  },
  {
    title: "Article 3 - Paiement",
    content: [
      "Le reglement de vos achats s'effectue par carte bancaire via Payzone, une plateforme de paiement 100 % securisee.",
      "Les cartes acceptees comprennent notamment Visa, MasterCard, Maestro, CMI, Diners Club et Discover. Les informations bancaires saisies sont cryptees et traitees en toute confidentialite. Aucune donnee bancaire n'est conservee sur notre site.",
      "Vous avez egalement la possibilite de regler votre commande en especes a la livraison, selon les zones eligibles. Cette option vous sera proposee lors de la validation de votre commande.",
      "En cas de refus de paiement par l'etablissement bancaire, la commande sera automatiquement annulee. Nous nous reservons egalement le droit de suspendre toute commande en cas de suspicion de fraude.",
    ],
  },
  {
    title: "Article 4 - Livraison",
    content: [
      "Les modalites, delais et frais sont detailles sur la page Livraison.",
      "Les commandes sont livrees a l'adresse indiquee par le client lors de la commande. Il est de sa responsabilite de verifier l'exactitude des informations fournies.",
      "En cas de retard ou de probleme de livraison, le client peut nous contacter via le service client pour obtenir assistance.",
    ],
  },
  {
    title: "Article 5 - Produits",
    content: [
      "Nous apportons un soin particulier a la description des produits, a la presentation des visuels et aux conseils d'utilisation disponibles sur notre site.",
      "Toutefois, des differences peuvent exister (changement de packaging, modification mineure de composition) sans que nous en soyons informes immediatement. En cas de doute, n'hesitez pas a contacter notre service client.",
      "Si vous constatez une erreur dans une fiche produit, vous pouvez nous en informer a l'adresse suivante : support@heypara.ma",
      "Aucun medicament n'est propose a la vente sur notre site.",
    ],
  },
  {
    title: "Article 6 - Droit et Delai de Retractation",
    content: [
      "Conformement a la loi ndeg 31-08 relative a la protection du consommateur, le client dispose d'un delai de 7 jours a compter de la reception de la commande pour exercer son droit de retractation.",
      "Chez Hey Para, nous acceptons les retours dans un delai de jusqu'a 7 jours apres la reception, sous reserve des conditions suivantes :",
    ],
    list: [
      "Les frais de retour sont a la charge du client",
      "Les produits doivent etre non ouverts, non utilises, dans leur etat d'origine et dans leur emballage intact",
      "Les produits relevant de l'hygiene (ex. : cosmetiques, complements alimentaires) ne peuvent etre retournes une fois ouverts, pour des raisons de securite sanitaire et de tracabilite",
    ],
    footer:
      "En cas de retour conforme, le remboursement sera effectue dans un delai maximum de 15 jours, a compter de la reception des produits retournes. Pour toute demande de retour, merci de contacter notre service client via support@heypara.ma avant toute expedition.",
  },
  {
    title: "Article 7 - Remboursement",
    content: [
      "En cas d'exercice valide du droit de retractation ou d'un retour accepte, le remboursement sera effectue dans un delai maximum de 15 jours a compter de la reception et verification des produits retournes.",
      "Les produits retournes doivent etre intacts, non utilises et dans leur emballage d'origine. Tout article endommage, incomplet ou non conforme ne pourra faire l'objet d'un remboursement.",
      "Les frais de livraison initiaux ne sont pas rembourses, sauf en cas d'erreur de notre part ou de produit defectueux.",
    ],
  },
];

const TermsPage = () => {
  return (
    <div className="horae-page py-14 md:py-20">
      <Container>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="border-y border-shop_light_green/35 py-8 md:py-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-shop_dark_green">
              Information Legale
            </p>
            <Title className="mt-2 text-3xl font-light uppercase tracking-[-0.045em] md:text-5xl">
              Conditions generales de vente
            </Title>
            <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
              Les presentes Conditions Generales de Vente (ci-apres &quot;CGV&quot;)
              s&apos;appliquent a toute commande effectuee sur le site{" "}
              <span className="font-semibold">www.heypara.ma</span> par un
              particulier agissant en tant que consommateur.
            </p>
            <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
              Le site est exploite par la societe{" "}
              <span className="font-semibold">Hey Para SARL</span> au capital
              de 100 000,00 Dhs, immatriculee au Registre de Commerce sous le
              numero 37481, identifiant fiscal 66272078, ICE 003693572000032,
              dont le siege social est situe a Lotissement Essediq NR 22 - 01
              Magasin RDC, Mohammedia.
            </p>
            <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
              En passant commande sur le site, le client accepte sans reserve
              les presentes conditions generales de vente. La societe se reserve
              le droit de les modifier a tout moment. Les CGV applicables sont
              celles en vigueur a la date de validation de la commande.
            </p>
          </div>

          <div className="space-y-5">
            {cgvArticles.map((article) => (
              <section
                key={article.title}
                className="border-b border-white/10 py-6 md:py-8"
              >
                <h2 className="font-editorial text-2xl font-medium uppercase text-darkColor md:text-3xl">
                  {article.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm md:text-base text-gray-700 leading-7">
                  {article.content.map((paragraph, index) => (
                    <p key={`${article.title}-p-${index}`}>{paragraph}</p>
                  ))}
                </div>

                {article.list?.length ? (
                  <ul className="mt-4 space-y-2 text-sm md:text-base text-gray-700 list-disc pl-5">
                    {article.list.map((item, index) => (
                      <li key={`${article.title}-l-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {article.footer ? (
                  <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
                    {article.footer}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
};

export default TermsPage;
