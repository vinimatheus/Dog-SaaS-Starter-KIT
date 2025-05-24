"use client"

import { Dog } from "lucide-react"
import { Caveat } from "next/font/google"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const caveat = Caveat({ 
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat"
})

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: {
      icon: "w-6 h-6",
      text: "text-xl",
      container: "p-0.5",
      textContainer: "py-0.5"
    },
    md: {
      icon: "w-8 h-8",
      text: "text-2xl",
      container: "p-1",
      textContainer: "py-1"
    },
    lg: {
      icon: "w-10 h-10",
      text: "text-3xl",
      container: "p-1.5",
      textContainer: "py-1.5"
    }
  }

  return (
    <motion.div 
      className={cn(
        "flex items-center gap-2",
        className
      )}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: "easeOut"
      }}
    >
      <motion.div
        className={cn(
          "flex items-center justify-center",
          sizes[size].container
        )}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.2
        }}
      >
        <Dog className={cn(
          "text-primary",
          sizes[size].icon
        )} />
      </motion.div>
      <motion.div
        className={cn(
          "flex items-center transform-gpu will-change-transform",
          sizes[size].textContainer
        )}
      >
        <motion.h1 
          className={cn(
            "font-bold text-black leading-none transform-gpu will-change-transform",
            sizes[size].text,
            caveat.className
          )}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.4,
            ease: "easeOut"
          }}
        >
          Dog SaaS
        </motion.h1>
      </motion.div>
    </motion.div>
  )
} 