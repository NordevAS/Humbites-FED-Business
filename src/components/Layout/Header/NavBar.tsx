"use client";

import Link from "next/link";
import "./Navbar.css";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function NavBar() {
  // Track mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Get current page path for active link styling
  const pathname = usePathname();

  // Check if current path matches link path
  const isActive = (path: string) => pathname === path;

  return (
    <>
      <nav className="navbar">
        {/* Logo and home link */}
        <Link href="/app" className="navbar-header-link">
          <div className="navbar-header">
            <Image
              src="/favicon.ico"
              alt="HumBites logo"
              width={150}
              height={150}
              className="navbar-logo"
            />
            <h1 className="navbar-title">HumBites</h1>
          </div>
        </Link>

        {/* Navigation menu - toggles on mobile */}
        <div className={`navbar-links ${mobileMenuOpen ? "open" : ""}`}>
          <Link href="/app" className={isActive("/app") ? "active" : ""}>
            <button
              className="navbar-btn"
              onClick={() => setMobileMenuOpen(false)}>
              <span className="btn-icon">📊</span>
              <span className="btn-text">Dashboard</span>
            </button>
          </Link>

          <Link
            href="/app/setting"
            className={isActive("/app/setting") ? "active" : ""}>
            <button
              className="navbar-btn"
              onClick={() => setMobileMenuOpen(false)}>
              <span className="btn-icon">⚙️</span>
              <span className="btn-text">Settings</span>
            </button>
          </Link>

          <Link
            href="/app/orders"
            className={isActive("/app/orders") ? "active" : ""}>
            <button
              className="navbar-btn"
              onClick={() => setMobileMenuOpen(false)}>
              <span className="btn-icon">📦</span>
              <span className="btn-text">Orders</span>
            </button>
          </Link>
        </div>

        {/* Mobile hamburger menu button */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu">
          <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}></span>
        </button>
      </nav>

      {/* Mobile menu overlay - closes menu when clicked */}
      <div
        className={`mobile-menu-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}></div>
    </>
  );
}
