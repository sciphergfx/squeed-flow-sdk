import { useState, useEffect } from "react";
import { isIconImage } from "./iconSources";

const DynamicIcon = ({ name, ...props }) => {
  const [IconComponent, setIconComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const image = typeof name === "string" && isIconImage(name);

  useEffect(() => {
    if (image || !name || name.length < 2) {
      setIconComponent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    const loadIcon = async () => {
      try {
        let library;
        if (name.startsWith("Md")) library = "md";
        else if (name.startsWith("Fa")) library = "fa6";
        else if (name.startsWith("Io5")) library = "io5";
        else if (name.startsWith("Io")) library = "io";
        else if (name.startsWith("Ti")) library = "ti";
        else if (name.startsWith("Go")) library = "go";
        else if (name.startsWith("Fi")) library = "fi";
        else if (name.startsWith("Di")) library = "di";
        else if (name.startsWith("Ai")) library = "ai";
        else if (name.startsWith("Bs")) library = "bs";
        else if (name.startsWith("Ri")) library = "ri";
        else if (name.startsWith("Fc")) library = "fc";
        else if (name.startsWith("Gi")) library = "gi";
        else if (name.startsWith("Hi2")) library = "hi2";
        else if (name.startsWith("Hi")) library = "hi";
        else if (name.startsWith("Si")) library = "si";
        else if (name.startsWith("Sl")) library = "sl";
        else if (name.startsWith("Im")) library = "im";
        else if (name.startsWith("Bi")) library = "bi";
        else if (name.startsWith("Pi")) library = "pi";
        else if (name.startsWith("Vsc")) library = "vsc";
        else if (name.startsWith("Tb")) library = "tb";
        else if (name.startsWith("Tfi")) library = "tfi";
        else if (name.startsWith("Cg")) library = "cg";
        else if (name.startsWith("Lia")) library = "lia";
        else if (name.startsWith("Lu")) library = "lu";
        else throw new Error(`Unknown library prefix for icon: ${name}`);

        let icons;
        switch (library) {
          case "md": icons = await import("react-icons/md"); break;
          case "fa6": icons = await import("react-icons/fa6"); break;
          case "io5": icons = await import("react-icons/io5"); break;
          case "io": icons = await import("react-icons/io"); break;
          case "ti": icons = await import("react-icons/ti"); break;
          case "go": icons = await import("react-icons/go"); break;
          case "fi": icons = await import("react-icons/fi"); break;
          case "di": icons = await import("react-icons/di"); break;
          case "ai": icons = await import("react-icons/ai"); break;
          case "bs": icons = await import("react-icons/bs"); break;
          case "ri": icons = await import("react-icons/ri"); break;
          case "fc": icons = await import("react-icons/fc"); break;
          case "gi": icons = await import("react-icons/gi"); break;
          case "hi2": icons = await import("react-icons/hi2"); break;
          case "hi": icons = await import("react-icons/hi"); break;
          case "si": icons = await import("react-icons/si"); break;
          case "sl": icons = await import("react-icons/sl"); break;
          case "im": icons = await import("react-icons/im"); break;
          case "bi": icons = await import("react-icons/bi"); break;
          case "pi": icons = await import("react-icons/pi"); break;
          case "vsc": icons = await import("react-icons/vsc"); break;
          case "tb": icons = await import("react-icons/tb"); break;
          case "tfi": icons = await import("react-icons/tfi"); break;
          case "cg": icons = await import("react-icons/cg"); break;
          case "lia": icons = await import("react-icons/lia"); break;
          case "lu": icons = await import("react-icons/lu"); break;
          default: throw new Error(`Unsupported library: ${library}`);
        }

        const icon = icons[name];
        if (!icon) throw new Error(`Icon ${name} not found in library ${library}`);

        setIconComponent(() => icon);
      } catch (err) {
        console.warn(`Failed to load icon ${name}:`, err.message);
        setError(true);
        setIconComponent(null);
      } finally {
        setLoading(false);
      }
    };

    loadIcon();
  }, [name, image]);

  if (image) {
    const { size = 80, style, ...imageProps } = props;
    return <img {...imageProps} src={name} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ objectFit: "contain", ...style }} />;
  }
  if (loading) return null;
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
};

export default DynamicIcon;
