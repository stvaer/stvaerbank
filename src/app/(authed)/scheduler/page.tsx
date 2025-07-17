
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Banknote } from "lucide-react"
import type { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp, where } from "firebase/firestore";
import type { User } from "firebase/auth";

import { billSchema, type Bill } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator"

interface BillWithId extends Bill {
    id: string;
}

interface SchedulerPageProps {
  user: User | null;
  db: any;
  firebaseUtils: any;
}

export default function SchedulerPage({ user, db, firebaseUtils }: SchedulerPageProps) {
  const [bills, setBills] = useState<BillWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [billDates, setBillDates] = useState<Date[]>([]);
  const { toast } = useToast();

  const form = useForm<Bill>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: undefined,
    },
  });

  const fetchBills = useCallback(async (uid: string) => {
        if (!db || !firebaseUtils) return;
        setLoading(true);

        const { collection, query, where, orderBy, getDocs, Timestamp } = firebaseUtils;

        try {
            const q = query(
                collection(db, "bills"), 
                where("userId", "==", uid),
                orderBy("dueDate", "asc")
            );
            const querySnapshot = await getDocs(q);
            const billsData = querySnapshot.docs.map((doc: any) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dueDate: (data.dueDate as Timestamp).toDate(),
                } as BillWithId;
            });
            setBills(billsData);
            setBillDates(billsData.map(bill => bill.dueDate));
        } catch (error) {
            console.error("Error al obtener facturas: ", error);
            toast({
                title: "Error",
                description: "No se pudieron obtener las facturas.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [db, firebaseUtils, toast]);

  useEffect(() => {
    if (user) {
        fetchBills(user.uid);
    } else {
        setBills([]);
        setLoading(false);
    }
  }, [user, fetchBills]);

  async function onSubmit(data: Bill) {
    if (!user || !db || !firebaseUtils) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una factura.",
        variant: "destructive",
      });
      return;
    }
    
    const { collection, addDoc, Timestamp } = firebaseUtils;

    try {
        const docRef = await addDoc(collection(db, "bills"), {
            ...data,
            userId: user.uid,
            dueDate: Timestamp.fromDate(data.dueDate),
        });
        const newBill: BillWithId = { ...data, id: docRef.id };
        const updatedBills = [...bills, newBill].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        setBills(updatedBills);
        setBillDates(updatedBills.map(bill => bill.dueDate));
        toast({
            title: "Factura Programada",
            description: `${data.name} por $${data.amount} ha sido añadida.`,
        });
        form.reset();
    } catch (error) {
        console.error("Error al añadir factura: ", error);
        toast({
            title: "Error",
            description: "No se pudo programar la factura.",
            variant: "destructive",
        });
    }
  }
  
  async function removeBill(id: string) {
    if (!db || !firebaseUtils) return;
    const billToRemove = bills.find(b => b.id === id);
    if (!billToRemove) return;

    const { doc, deleteDoc } = firebaseUtils;

    try {
        await deleteDoc(doc(db, "bills", id));
        const updatedBills = bills.filter((bill) => bill.id !== id);
        setBills(updatedBills);
        setBillDates(updatedBills.map(bill => bill.dueDate));
        toast({
            title: "Factura Eliminada",
            description: `${billToRemove.name} ha sido eliminada del calendario.`,
            variant: "destructive"
        });
    } catch (error) {
        console.error("Error al eliminar factura: ", error);
        toast({
            title: "Error",
            description: "No se pudo eliminar la factura.",
            variant: "destructive",
        });
    }
  }

  const modifiers = {
    billDay: billDates,
  };

  const modifiersClassNames = {
    billDay: 'bill-due-day',
  };
  
  const BillIcon = () => <Banknote className="h-3 w-3 text-white absolute bottom-1 right-1" />;

  return (
    <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Programar una Factura</CardTitle>
            <CardDescription>Añade un nuevo recordatorio de factura a tu calendario.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Factura</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. Netflix" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Vencimiento</FormLabel>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Factura
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>Calendario de Pagos</CardTitle>
                <CardDescription>Una vista general de tus próximas facturas.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                <Calendar
                    mode="single"
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    components={{
                        DayContent: (props) => {
                            const isBillDay = billDates.some(d => format(d, 'yyyy-MM-dd') === format(props.date, 'yyyy-MM-dd'));
                            return (
                                <div className="relative h-full w-full flex items-center justify-center">
                                    <span>{props.date.getDate()}</span>
                                    {isBillDay && <BillIcon />}
                                </div>
                            );
                        }
                    }}
                    className="p-3 w-full max-w-sm"
                 />
            </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Facturas Próximas</CardTitle>
                <CardDescription>Tus pagos más cercanos.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-lg border">
                          <Skeleton className="h-4 w-20 mb-4" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-1/3" />
                          </div>
                        </div>
                      ))
                    ) : bills.length > 0 ? (
                      bills.map((bill, index) => (
                        <div key={bill.id}>
                          <div className="p-4 rounded-lg relative">
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => removeBill(bill.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <p className="text-xs font-mono text-muted-foreground mb-2">ID#{bill.id.substring(0, 5).toUpperCase()}</p>
                            <div className="space-y-1">
                                <div>
                                    <p className="text-xs text-muted-foreground">FACTURA</p>
                                    <p className="font-medium truncate">{bill.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">VENCE</p>
                                    <p className="font-medium">{format(bill.dueDate, "PPP")}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">MONTO</p>
                                    <p className="font-semibold text-primary">${bill.amount.toFixed(2)}</p>
                                </div>
                            </div>
                          </div>
                          {index < bills.length - 1 && <Separator />}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No tienes facturas próximas.</p>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
