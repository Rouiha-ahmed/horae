import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import Logo from "./Logo";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "./ui/button";

const NoAccess = ({
  details = "Connectez-vous pour voir votre panier et finaliser votre commande.",
}: {
  details?: string;
}) => {
  return (
    <div className="horae-page flex items-center justify-center p-5 py-16 md:py-28">
      <Card className="w-full max-w-lg rounded-[28px] border-white/10 bg-[#071522]/72 p-6 shadow-none md:p-10">
        <CardHeader className="flex items-center flex-col">
          <Logo />
          <CardTitle className="font-editorial text-center text-4xl font-light uppercase">
            Bon retour !
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center font-medium text-darkColor/80">{details}</p>
          <SignInButton mode="modal">
            <Button className="horae-button w-full" size="lg">
              Se connecter
            </Button>
          </SignInButton>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Vous n&apos;avez pas de compte ?
          </div>
          <SignUpButton mode="modal">
            <Button variant="outline" className="horae-outline-button w-full" size="lg">
              Creer un compte
            </Button>
          </SignUpButton>
        </CardFooter>
      </Card>
    </div>
  );
};

export default NoAccess;
