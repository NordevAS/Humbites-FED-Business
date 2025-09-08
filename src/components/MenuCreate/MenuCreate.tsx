import { useState } from "react";
import "./MenuCreate.css";
import Image from "next/image";
export default function MenuCreate() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; //typing typing typing....
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file); // makes sure it displays properly
    }
  };

  return (
    <div className="trans-p-bg">
      <div id="createMenu">
        <form id="form">
          <input type="text" name="name" id="Name-field" placeholder="Name of dish" required />
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange} //this makes sure tthe svg takes in imgs

            />
          <label htmlFor="file-upload">
            <Image src="/upload.svg" alt="Upload icon" width="48" height="48" />
          </label>
        {imageSrc && (
          <div>
            <h3>Uploaded Image:</h3>
            <Image src={imageSrc} alt="Uploaded"   id="menu-img"/>
          </div> // this creates a component if a img is added
        )}
        <input type="number" placeholder="price" required />
        <textarea id="desc-field" placeholder="Description"></textarea>
        <button type="submit" id="btn-creator">create</button>
        </form>
      </div>
    </div>
  );
}