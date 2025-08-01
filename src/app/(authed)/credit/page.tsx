
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Timestamp } from "firebase/firestore";
import { PlusCircle, MoreVertical, SquarePlus, FileText, Search, Calendar as CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { creditCardSchema, statementSchema, type CreditCard, type Statement, paymentSchema, type Payment } from "@/lib/schemas";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useFirebase } from "@/hooks/use-firebase";


interface CreditCardWithId extends CreditCard {
  id: string;
}

interface StatementWithId extends Statement {
    id: string;
    dueDate: Date;
}

export default function CreditPage() {
  const { user, db, firebaseUtils } = useFirebase();
  const [cards, setCards] = useState<CreditCardWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<CreditCardWithId | null>(null);
  const [statements, setStatements] = useState<StatementWithId[]>([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [isViewStatementsModalOpen, setViewStatementsModalOpen] = useState(false);
  const [isEditStatementModalOpen, setEditStatementModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<StatementWithId | null>(null);
  const { toast } = useToast();


  const cardForm = useForm<CreditCard>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      cardName: "",
      bank: "",
      creditLimit: 0,
      currentDebt: 0,
      lastFourDigits: "",
    },
  });

  const paymentForm = useForm<Payment>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0 },
  });

  const statementForm = useForm<Statement>({
    resolver: zodResolver(statementSchema),
    defaultValues: {
        month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        statementBalance: 0,
        minimumPayment: 0,
        paymentForNoInterest: 0,
        dueDate: new Date(),
    }
  });

    const fetchCreditCards = useCallback(async (uid: string) => {
        if (!db || !firebaseUtils) return;
        setLoading(true);
        try {
            const { collection, query, where, getDocs } = firebaseUtils;
            const q = query(collection(db, "credit_cards"), where("userId", "==", uid));
            const querySnapshot = await getDocs(q);
            const cardsData = querySnapshot.docs.map((doc: any) => ({
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
    }, [db, firebaseUtils, toast]);

    useEffect(() => {
        if (user) {
            fetchCreditCards(user.uid);
        } else {
            setLoading(false);
            setCards([]);
        }
    }, [user, fetchCreditCards]);


  async function onCardSubmit(data: CreditCard) {
    if (!user || !db || !firebaseUtils) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una tarjeta.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { collection, addDoc } = firebaseUtils;
      const docRef = await addDoc(collection(db, "credit_cards"), {
        ...data,
        userId: user.uid,
      });
      setCards([...cards, { ...data, id: docRef.id }]);
      toast({
        title: "Tarjeta Añadida",
        description: `La tarjeta ${data.cardName} ha sido añadida exitosamente.`,
      });
      cardForm.reset();
    } catch (error) {
      console.error("Error al añadir tarjeta: ", error);
      toast({
        title: "Error",
        description: "No se pudo añadir la tarjeta.",
        variant: "destructive",
      });
    }
  }

  async function onPaymentSubmit(data: Payment) {
    if (!user || !selectedCard || !db || !firebaseUtils) return;

    const { writeBatch, doc, collection, Timestamp } = firebaseUtils;

    const paymentAmount = data.amount;
    const newDebt = selectedCard.currentDebt - paymentAmount;

    try {
        const batch = writeBatch(db);

        const cardRef = doc(db, "credit_cards", selectedCard.id);
        batch.update(cardRef, { currentDebt: newDebt });

        const transactionRef = doc(collection(db, "transactions"));
        batch.set(transactionRef, {
            description: `Pago a tarjeta ${selectedCard.cardName}`,
            amount: paymentAmount,
            type: 'expense',
            category: 'Pago de Tarjeta',
            userId: user.uid,
            date: Timestamp.now(),
        });
        
        await batch.commit();

        toast({
            title: "Pago Registrado",
            description: `Se registró un pago de ${formatCurrency(paymentAmount)} a la tarjeta ${selectedCard.cardName}.`
        });
        await fetchCreditCards(user.uid);
        setPaymentModalOpen(false);
        paymentForm.reset();
    } catch (error) {
        console.error("Error al registrar el pago: ", error);
        toast({ title: "Error", description: "No se pudo registrar el pago.", variant: "destructive" });
    }
  }

  async function onStatementSubmit(data: Statement) {
      if (!user || !selectedCard || !db || !firebaseUtils) return;

      const { collection, addDoc, Timestamp } = firebaseUtils;

      try {
        await addDoc(collection(db, "statements"), {
            ...data,
            cardId: selectedCard.id,
            userId: user.uid,
            isPaid: false,
            dueDate: Timestamp.fromDate(data.dueDate),
        });
        toast({
            title: "Estado de Cuenta Añadido",
            description: `Se añadió el estado de cuenta de ${selectedCard.cardName} para el mes ${data.month}.`
        });
        setStatementModalOpen(false);
        statementForm.reset();
      } catch (error) {
        console.error("Error al añadir estado de cuenta: ", error);
        toast({ title: "Error", description: "No se pudo añadir el estado de cuenta.", variant: "destructive" });
      }
  }

  async function onStatementUpdate(data: Statement) {
      if (!editingStatement || !db || !firebaseUtils) return;

      const { doc, updateDoc, Timestamp } = firebaseUtils;

      try {
          const statementRef = doc(db, "statements", editingStatement.id);
          await updateDoc(statementRef, {
              ...data,
              dueDate: Timestamp.fromDate(data.dueDate),
          });

          toast({
              title: "Estado de Cuenta Actualizado",
              description: `El estado de cuenta del mes ${data.month} ha sido actualizado.`,
          });
          setEditStatementModalOpen(false);
          setEditingStatement(null);
          // Refresh the statements list
          if (selectedCard) {
            await onViewStatements(selectedCard);
          }
      } catch (error) {
          console.error("Error al actualizar el estado de cuenta: ", error);
          toast({ title: "Error", description: "No se pudo actualizar el estado de cuenta.", variant: "destructive" });
      }
  }

  async function onViewStatements(card: CreditCardWithId) {
    if (!user || !db || !firebaseUtils) return;
    setSelectedCard(card);

    const { collection, query, where, orderBy, getDocs, Timestamp } = firebaseUtils;

    try {
        const q = query(
            collection(db, "statements"), 
            where("userId", "==", user.uid),
            where("cardId", "==", card.id),
            orderBy("month", "desc")
        );
        const querySnapshot = await getDocs(q);
        const statementsData = querySnapshot.docs.map((doc: any) => {
            const data = doc.data();
            const dueDate = data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date();
            return {
                id: doc.id,
                ...data,
                dueDate: dueDate,
            } as StatementWithId
        });
        setStatements(statementsData);
        setViewStatementsModalOpen(true);
    } catch (error) {
       console.error("Error al obtener estados de cuenta: ", error);
       toast({ title: "Error", description: "No se pudieron obtener los estados de cuenta.", variant: "destructive" });
    }
  }

  function handleEditStatement(statement: StatementWithId) {
      setEditingStatement(statement);
      statementForm.reset({
        ...statement,
        dueDate: statement.dueDate,
      });
      setEditStatementModalOpen(true);
  }

  async function handleDeleteCard(cardId: string) {
    if (!user || !db || !firebaseUtils) return;
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarjeta y todos sus estados de cuenta asociados? Esta acción no se puede deshacer.")) {
        return;
    }

    const { doc, deleteDoc } = firebaseUtils;
    
    try {
        await deleteDoc(doc(db, "credit_cards", cardId));
        toast({
            title: "Tarjeta Eliminada",
            description: "La tarjeta de crédito ha sido eliminada.",
            variant: "destructive"
        });
        await fetchCreditCards(user.uid);
    } catch (error) {
        console.error("Error al eliminar la tarjeta: ", error);
        toast({ title: "Error", description: "No se pudo eliminar la tarjeta.", variant: "destructive" });
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <>
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
              <Form {...cardForm}>
                <form onSubmit={cardForm.handleSubmit(onCardSubmit)} className="space-y-4">
                  <FormField
                    control={cardForm.control}
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
                    control={cardForm.control}
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
                    control={cardForm.control}
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
                    control={cardForm.control}
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
                    control={cardForm.control}
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
              cards.map((card: CreditCardWithId) => {
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
                          <DropdownMenuItem onSelect={() => { setSelectedCard(card); setPaymentModalOpen(true); }}>
                            Registrar Pago
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => { setSelectedCard(card); setStatementModalOpen(true); }}>
                            Añadir Estado de Cuenta
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onViewStatements(card)}>
                            <Search className="mr-2 h-4 w-4" /> Ver Estados de Cuenta
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteCard(card.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Tarjeta
                          </DropdownMenuItem>
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
                    <CardFooter className="flex justify-end gap-2">
                      <Button size="icon" variant="outline" onClick={() => { setSelectedCard(card); setPaymentModalOpen(true); }}>
                        <SquarePlus className="h-4 w-4" />
                        <span className="sr-only">Registrar Pago</span>
                      </Button>
                      <Button size="icon" onClick={() => { setSelectedCard(card); setStatementModalOpen(true); }}>
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">Añadir Estado de Cuenta</span>
                      </Button>
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
      
      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Registrar Pago a {selectedCard?.cardName}</DialogTitle>
                <DialogDescription>
                    La deuda actual es de {formatCurrency(selectedCard?.currentDebt || 0)}. El pago se registrará como un gasto.
                </DialogDescription>
            </DialogHeader>
            <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
                    <FormField
                        control={paymentForm.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Monto del Pago</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="submit">Confirmar Pago</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Statement Modal (Add) */}
      <Dialog open={isStatementModalOpen} onOpenChange={setStatementModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Añadir Estado de Cuenta</DialogTitle>
                <DialogDescription>
                    Registra los detalles del estado de cuenta de {selectedCard?.cardName}.
                </DialogDescription>
            </DialogHeader>
            <Form {...statementForm}>
                <form onSubmit={statementForm.handleSubmit(onStatementSubmit)} className="space-y-4">
                     <FormField
                        control={statementForm.control}
                        name="month"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mes (YYYY-MM)</FormLabel>
                                <FormControl>
                                    <Input placeholder="ej. 2024-07" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="statementBalance"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Saldo del Estado de Cuenta</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="minimumPayment"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pago Mínimo</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="paymentForNoInterest"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pago para no Generar Intereses</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha Límite de Pago</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Elige una fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <DialogFooter>
                        <Button type="submit">Guardar Estado de Cuenta</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* View Statements Modal */}
      <Dialog open={isViewStatementsModalOpen} onOpenChange={setViewStatementsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Estados de Cuenta de {selectedCard?.cardName}</DialogTitle>
                <DialogDescription>
                    Historial de estados de cuenta registrados para esta tarjeta.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-4 -mr-4">
                {statements.length > 0 ? (
                    statements.map((statement: StatementWithId, index: number) => (
                        <div key={statement.id}>
                            <div className="p-4 rounded-lg space-y-3 relative group">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditStatement(statement)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <p className="text-sm font-semibold">Mes: {statement.month}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground">SALDO TOTAL</p>
                                        <p className="font-medium">{formatCurrency(statement.statementBalance)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">PAGO MÍNIMO</p>
                                        <p className="font-medium">{formatCurrency(statement.minimumPayment)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">PAGO S/INTERÉS</p>
                                        <p className="font-medium">{formatCurrency(statement.paymentForNoInterest)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">VENCIMIENTO</p>
                                        <p className="font-medium">{format(statement.dueDate, "PPP")}</p>
                                    </div>
                                </div>
                            </div>
                            {index < statements.length - 1 && <Separator />}
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-center py-8">No hay estados de cuenta registrados.</p>
                )}
            </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Statement Modal */}
      <Dialog open={isEditStatementModalOpen} onOpenChange={setEditStatementModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Editar Estado de Cuenta</DialogTitle>
                <DialogDescription>
                    Actualiza los detalles del estado de cuenta de {selectedCard?.cardName} para el mes {editingStatement?.month}.
                </DialogDescription>
            </DialogHeader>
            <Form {...statementForm}>
                <form onSubmit={statementForm.handleSubmit(onStatementUpdate)} className="space-y-4">
                     <FormField
                        control={statementForm.control}
                        name="month"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mes (YYYY-MM)</FormLabel>
                                <FormControl>
                                    <Input placeholder="ej. 2024-07" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="statementBalance"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Saldo del Estado de Cuenta</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="minimumPayment"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pago Mínimo</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="paymentForNoInterest"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pago para no Generar Intereses</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={statementForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fecha Límite de Pago</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Elige una fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <DialogFooter>
                        <Button type="submit">Actualizar Estado de Cuenta</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

    