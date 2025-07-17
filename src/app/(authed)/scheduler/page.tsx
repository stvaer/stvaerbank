
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Banknote } from "lucide-react"
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { billSchema, type Bill } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { db, app } from "@/lib/firebase";
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton";

interface BillWithId extends Bill {
    id: string;
}

export default function SchedulerPage() {
  const [bills, setBills] = useState<BillWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [billDates, setBillDates] = useState<Date[]>([]);
  const { toast } = useToast();
  const auth = getAuth(app);
  const user = auth.currentUser;

  const form = useForm<Bill>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: undefined,
    },
  });

  useEffect(() => {
    const fetchBills = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            const q = query(
                collection(db, "bills"), 
                where("userId", "==", user.uid),
                orderBy("dueDate", "asc")
            );
            const querySnapshot = await getDocs(q);
            const billsData = querySnapshot.docs.map(doc => {
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
    };

    fetchBills();
  }, [toast, user]);

  async function onSubmit(data: Bill) {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una factura.",
        variant: "destructive",
      });
      return;
    }
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
    const billToRemove = bills.find(b => b.id === id);
    if (!billToRemove) return;

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
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
      <div className="lg:w-2/5 space-y-6 flex-shrink-0">
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
                        <Input type="number" placeholder="0.00" {...field} />
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
      </div>

      <div className="flex-1 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Calendario de Pagos</CardTitle>
             <CardDescription>Una vista general de tus próximas facturas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col xl:flex-row gap-6">
            <div className="flex justify-center xl:flex-1">
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
            </div>
            <div className="flex-1 xl:border-l xl:pl-6 space-y-4">
              <h3 className="text-lg font-medium">Facturas Próximas</h3>
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      bills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell className="font-medium truncate max-w-28">{bill.name}</TableCell>
                          <TableCell>{format(bill.dueDate, "PPP")}</TableCell>
                          <TableCell className="text-right">${bill.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => removeBill(bill.id)}>
                             <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
