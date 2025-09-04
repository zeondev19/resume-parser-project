import Image from "next/image";
import UploadForm from "./components/UploadForm";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <UploadForm />
    </main>
  );
}
