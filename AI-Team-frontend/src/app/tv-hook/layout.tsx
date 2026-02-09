import "../globals.css";

export const runtime = 'edge';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full h-screen overflow-hidden bg-black text-white m-0 p-0">
            {children}
        </div>
    );
}
