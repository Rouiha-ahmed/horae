import Container from "@/components/Container";
import Title from "@/components/Title";
import React from "react";

const privacySections = [
  {
    title: "1. Responsable du traitement",
    content: [
      "Hey Para est gere par :",
      "HEY PARA SARL",
      "Siege social : Lotissement Essediq NR 22 - 01 Magasin RDC, Mohammedia",
      "RC : 37481",
      "IF : 66272078",
      "ICE : 003693572000032",
      "Contact : contact@heypara.ma",
    ],
  },
  {
    title: "2. Donnees collectees",
    content: [
      "Nous collectons uniquement les donnees necessaires a la bonne execution de nos services :",
    ],
    list: [
      "Nom, prenom",
      "Adresse e-mail",
      "Adresse postale et de livraison",
      "Numero de telephone",
      "Historique de commande",
      "Donnees de paiement (traitees par un prestataire securise)",
      "Donnees de navigation (cookies, IP, comportement)",
    ],
  },
  {
    title: "3. Exactitude des donnees fournies",
    content: [
      "Vous vous engagez a fournir des donnees personnelles exactes, a jour, et a les corriger en cas de changement. Vous certifiez :",
    ],
    list: [
      "Avoir au moins 18 ans, ou etre mineur emancipe, ou utiliser le site sous la supervision d'un representant legal",
      "Etre le titulaire legitime de tout contenu ou donnee fournie",
      "Ne pas porter atteinte a des droits de propriete intellectuelle ou droits de tiers",
      "Disposer de l'autorite necessaire si vous agissez au nom d'une entite professionnelle",
    ],
  },
  {
    title: "4. Finalites du traitement",
    content: ["Vos donnees sont traitees dans les buts suivants :"],
    list: [
      "Traitement, paiement et livraison des commandes",
      "Suivi client, SAV, retours",
      "Envoi d'informations liees a votre commande ou a nos offres (si vous y avez consenti)",
      "Prevention des fraudes et securite",
      "Amelioration continue de l'experience utilisateur",
      "Statistiques anonymes a des fins internes ou de marche",
    ],
  },
  {
    title: "5. Utilisation et transmission des donnees",
    content: [
      "Vos donnees ne sont jamais vendues ni louees. Elles peuvent etre partagees uniquement avec :",
    ],
    list: [
      "Prestataires de livraison",
      "Prestataires de paiement securise",
      "Plateformes d'hebergement et de maintenance",
      "Outils d'e-mailing et d'analyse",
    ],
    footer:
      "Nous exigeons de nos partenaires un respect strict des normes de securite et de confidentialite.",
  },
  {
    title: "6. Acces a vos donnees",
    content: [
      "Vous pouvez consulter et modifier vos donnees en vous connectant a votre compte client. Vous y trouverez :",
    ],
    list: [
      "Vos informations personnelles",
      "L'historique de vos commandes",
      "Vos preferences d'abonnement a la newsletter",
    ],
  },
  {
    title: "7. Vos droits",
    content: [
      "Conformement a la loi 09-08, vous disposez de :",
    ],
    list: [
      "Droit d'acces a vos donnees",
      "Droit de rectification",
      "Droit de suppression",
      "Droit d'opposition pour motifs legitimes",
      "Droit de retirer votre consentement",
    ],
    footer:
      "Pour exercer ces droits, contactez-nous a contact@heypara.ma ou a notre adresse postale.",
  },
  {
    title: "8. Cookies",
    content: ["Notre site utilise des cookies pour :"],
    list: [
      "Optimiser le fonctionnement technique",
      "Analyser la frequentation",
      "Personnaliser les contenus",
    ],
    footer:
      "Vous pouvez a tout moment modifier vos preferences via votre navigateur.",
  },
  {
    title: "9. Securite des donnees",
    content: [
      "Vos donnees sont stockees sur des serveurs securises proteges par des dispositifs technologiques et humains. Des audits et verifications peuvent etre effectues par des tiers pour garantir le respect de nos engagements.",
    ],
  },
  {
    title: "10. Utilisation commerciale",
    content: [
      "Votre adresse email peut etre utilisee pour l'envoi d'informations ou d'offres commerciales. A tout moment, vous pouvez vous desinscrire en cliquant sur le lien prevu a cet effet dans nos emails.",
    ],
  },
  {
    title: "11. Traitement par des tiers",
    content: [
      "Toute utilisation de vos donnees par des partenaires est encadree contractuellement. Aucune donnee n'est transmise sans votre consentement explicite, sauf obligation legale ou interet legitime clairement justifie.",
    ],
  },
  {
    title: "12. Mise a jour de la politique",
    content: [
      "Nous nous reservons le droit de modifier la presente Politique. Toute mise a jour sera affichee sur cette page. La version en vigueur est celle en ligne a la date de votre consultation.",
    ],
  },
];

const PrivacyPage = () => {
  return (
    <div className="horae-page py-14 md:py-20">
      <Container>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="border-y border-shop_light_green/35 py-8 md:py-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-shop_dark_green">
              Donnees Personnelles
            </p>
            <Title className="mt-2 text-3xl font-light uppercase tracking-[-0.045em] md:text-5xl">
              Politique de confidentialite
            </Title>
            <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
              Chez Hey Para, la protection de vos donnees personnelles est au
              coeur de nos engagements. En accedant a notre site{" "}
              <span className="font-semibold">www.heypara.ma</span>, vous
              acceptez la presente politique de confidentialite, conforme a la
              loi ndeg 09-08 du 18 fevrier 2009 relative a la protection des
              personnes physiques a l&apos;egard du traitement des donnees a
              caractere personnel.
            </p>
          </div>

          <div className="space-y-5">
            {privacySections.map((section) => (
              <section
                key={section.title}
                className="border-b border-white/10 py-6 md:py-8"
              >
                <h2 className="font-editorial text-2xl font-medium uppercase text-darkColor md:text-3xl">
                  {section.title}
                </h2>

                <div className="mt-3 space-y-3 text-sm md:text-base text-gray-700 leading-7">
                  {section.content.map((paragraph, index) => (
                    <p key={`${section.title}-p-${index}`}>{paragraph}</p>
                  ))}
                </div>

                {section.list?.length ? (
                  <ul className="mt-4 space-y-2 text-sm md:text-base text-gray-700 list-disc pl-5">
                    {section.list.map((item, index) => (
                      <li key={`${section.title}-l-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {section.footer ? (
                  <p className="mt-4 text-sm md:text-base text-gray-700 leading-7">
                    {section.footer}
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

export default PrivacyPage;
