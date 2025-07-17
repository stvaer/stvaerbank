
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { PlusCircle, MoreVertical } from "lucide-react";

import { db, app } from "@/lib/firebase";
import { creditCardSchema, type CreditCard } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CreditCardWithId extends CreditCard {
  id: string;
}

export default function CreditPage() {
  const [cards, setCards] = useState<CreditCardWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const auth = getAuth(app);
  const user = auth.currentUser;

  const form = useForm<CreditCard>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      cardName: "",
      bank: "",
      creditLimit: 0,
      currentDebt: 0,
      lastFourDigits: "",
    },
  });

  useEffect(() => {
    const fetchCreditCards = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, "credit_cards"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const cardsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as CreditCardWithId));
        setCards(cardsData);
      } catch (error) {
        console.error("Error al obtener tarjetas de crédito: ", error);
        toast({
          title: "Error",
          description: "No se pudieron obtener las tarjetas de crédito.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCreditCards();
  }, [toast, user]);

  async function onSubmit(data: CreditCard) {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una tarjeta.",
        variant: "destructive",
      });
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "credit_cards"), {
        ...data,
        userId: user.uid,
      });
      setCards([...cards, { ...data, id: docRef.id }]);
      toast({
        title: "Tarjeta Añadida",
        description: `La tarjeta ${data.cardName} ha sido añadida exitosamente.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error al añadir tarjeta: ", error);
      toast({
        title: "Error",
        description: "No se pudo añadir la tarjeta.",
        variant: "destructive",
      });
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
      <div className="lg:w-1/3 flex-shrink-0">
        <Card>
          <CardHeader>
            <CardTitle>Añadir Tarjeta de Crédito</CardTitle>
            <CardDescription>
              Registra una nueva tarjeta para llevar un control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="cardName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Tarjeta</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. Visa Platinum" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. BBVA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastFourDigits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Últimos 4 Dígitos</FormLabel>
                      <FormControl>
                        <Input placeholder="1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite de Crédito</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="5000"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentDebt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deuda Actual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1500"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Tarjeta
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-semibold mb-4">Tarjetas Registradas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-8 w-3/4" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          ) : cards.length > 0 ? (
            cards.map((card) => {
              const usagePercentage = (card.currentDebt / card.creditLimit) * 100;
              return (
                <Card key={card.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>{card.cardName}</CardTitle>
                      <CardDescription>
                        {card.bank} - **** {card.lastFourDigits}
                      </CardDescription>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Registrar Pago</DropdownMenuItem>
                          <DropdownMenuItem>Añadir Estado de Cuenta</DropdownMenuItem>
                           <DropdownMenuItem className="text-destructive">Eliminar Tarjeta</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="font-medium">Deuda Actual</span>
                            <span className="font-semibold text-primary">{formatCurrency(card.currentDebt)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Límite de Crédito</span>
                            <span>{formatCurrency(card.creditLimit)}</span>
                        </div>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                  </CardContent>
                  <CardFooter className="flex gap-2">
                     <Button className="w-full" variant="outline">Registrar Pago</Button>
                     <Button className="w-full">Estado de Cuenta</Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <p className="text-muted-foreground text-center col-span-full py-8">
              No tienes tarjetas de crédito registradas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}