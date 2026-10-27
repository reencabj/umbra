import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Data, Profile } from "./lib/types";
import { configured, db, rows } from "./lib/supabase";
import { productPhotos } from "./lib/photos";
interface State {
  session: Session | null;
  profile: Profile | null;
  data: Data | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}
const Context = createContext<State>(null!);
export const useApp = () => useContext(Context);
export function Provider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!configured) return;
    db.auth.getSession().then(({ data }) => {
      productPhotos.setScope(data.session?.user.id || null);
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_e, s) => {
      productPhotos.setScope(s?.user.id || null);
      setSession(s);
      if (!s) {
        setData(null);
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const reload = useCallback(async () => {
    if (!session) return;
    setError("");
    try {
      const { data: p, error: e } = await db
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!p || !p.enabled) {
        productPhotos.setScope(null);
        setData(null);
        setProfile(null);
        throw Error(
          "Tu cuenta no tiene acceso autorizado. Contactá al administrador.",
        );
      }
      setProfile(p);
      productPhotos.setScope(session.user.id);
      const tables = [
        "settings",
        "categories",
        "products",
        "prices",
        "organizations",
        "contacts",
        "limit_exceptions",
        "combos",
        "orders",
        "order_items",
        "inventory_movements",
        "stock",
        "weekly_usage",
        ...(p.role === "admin" ? ["authorized_users", "profiles"] : []),
      ];
      const all = await Promise.all(tables.map((t) => rows(t)));
      const mapped = Object.fromEntries(tables.map((t, i) => [t, all[i]]));
      void productPhotos
        .prefetch(
          (mapped.products as Data["products"])
            .filter((p) => p.active && !p.archived && p.image_path)
            .map((p) => p.image_path!),
        )
        .catch(() => undefined);
      setData({
        profiles: mapped.profiles || [p],
        settings: mapped.settings[0],
        categories: mapped.categories,
        products: mapped.products,
        prices: mapped.prices,
        organizations: mapped.organizations,
        contacts: mapped.contacts,
        exceptions: mapped.limit_exceptions,
        combos: mapped.combos,
        orders: mapped.orders,
        items: mapped.order_items,
        movements: mapped.inventory_movements,
        stock: mapped.stock,
        usage: mapped.weekly_usage,
        users: mapped.authorized_users || [],
      } as Data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : (e as { message?: string }).message ||
              "No se pudieron cargar los datos.",
      );
    } finally {
      setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const timer = setInterval(() => {
      void reload();
    }, 60000);
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [reload]);
  return (
    <Context.Provider
      value={{ session, profile, data, loading, error, reload }}
    >
      {children}
    </Context.Provider>
  );
}
