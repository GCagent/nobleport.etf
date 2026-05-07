'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { scoreLead, getFollowUpMessage } from '@/lib/leadScoring'
import { PHONE_NUMBER, SMS_LINK } from '@/lib/constants'

const PROJECT_TYPES = [
  'Deck',
  'Kitchen',
  'Bath',
  'Addition',
  'Exterior / Roofing',
  'Windows / Doors',
  'Renovation',
  'Other',
] as const

const BUDGET_RANGES = [
  '$15K–$25K',
  '$25K–$50K',
  '$50K+',
  'Not sure yet',
] as const

const TIMELINES = [
  'Less than 30 days',
  '1–3 months',
  '3–6 months',
  'Planning stage',
] as const

interface FormData {
  fullName: string
  phone: string
  town: string
  projectType: string
  budget: string
  timeline: string
  description: string
}

export default function QuotePage() {
  const [form, setForm] = useState<FormData>({
    fullName: '',
    phone: '',
    town: '',
    projectType: '',
    budget: '',
    timeline: '',
    description: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [followUp, setFollowUp] = useState('')

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const score = scoreLead({
      budget: form.budget,
      timeline: form.timeline,
      projectType: form.projectType,
      town: form.town,
    })

    // In production: send form + score to your backend / webhook
    console.log('Lead submitted:', { ...form, score })

    setFollowUp(getFollowUpMessage(score.priority))
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-noble-black flex items-center justify-center px-6">
        <div className="bg-white rounded-xl p-10 max-w-md text-center shadow-lg">
          <div className="text-noble-gold text-5xl mb-4">&#10003;</div>
          <h1 className="font-display text-2xl font-bold mb-3">
            Got it.
          </h1>
          <p className="text-gray-600 mb-6">
            We&rsquo;ll text you within 24 hours if it&rsquo;s a fit. North
            Shore projects only.
          </p>
          <p className="text-sm text-gray-500 italic mb-6">{followUp}</p>
          <Link href="/" className="btn-primary text-base px-6 py-3">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-noble-cream">
      {/* Header */}
      <div className="bg-noble-black text-white py-8 px-6 text-center">
        <Link
          href="/"
          className="text-noble-gold hover:underline text-sm mb-2 inline-block"
        >
          &larr; NoblePort Construction
        </Link>
        <h1 className="font-display text-3xl font-bold">Get Your Estimate</h1>
        <p className="text-gray-400 mt-2">
          North Shore MA &middot; $15K+ Projects
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto bg-white rounded-xl shadow-md p-8 my-10"
      >
        {/* Full Name */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Full Name *
          </span>
          <input
            type="text"
            name="fullName"
            required
            value={form.fullName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 focus:border-noble-gold focus:ring-noble-gold"
          />
        </label>

        {/* Phone Number */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Phone Number *
          </span>
          <input
            type="tel"
            name="phone"
            required
            value={form.phone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 focus:border-noble-gold focus:ring-noble-gold"
          />
        </label>

        {/* Town / Project Location */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Town / Project Location *
          </span>
          <input
            type="text"
            name="town"
            required
            placeholder="e.g. Newburyport"
            value={form.town}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 focus:border-noble-gold focus:ring-noble-gold"
          />
        </label>

        {/* Project Type */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Project Type *
          </span>
          <select
            name="projectType"
            required
            value={form.projectType}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 bg-white focus:border-noble-gold focus:ring-noble-gold"
          >
            <option value="">Select...</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {/* Budget Range */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Budget Range *
          </span>
          <select
            name="budget"
            required
            value={form.budget}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 bg-white focus:border-noble-gold focus:ring-noble-gold"
          >
            <option value="">Select...</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        {/* Timeline */}
        <label className="block mb-5">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Timeline *
          </span>
          <select
            name="timeline"
            required
            value={form.timeline}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 bg-white focus:border-noble-gold focus:ring-noble-gold"
          >
            <option value="">Select...</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {/* Brief Description */}
        <label className="block mb-8">
          <span className="text-sm font-semibold text-noble-dark uppercase tracking-wide">
            Brief Project Description
          </span>
          <textarea
            name="description"
            maxLength={150}
            rows={3}
            value={form.description}
            onChange={handleChange}
            placeholder="150 characters max"
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 focus:border-noble-gold focus:ring-noble-gold resize-none"
          />
          <span className="text-xs text-gray-400 mt-1 block">
            {form.description.length}/150
          </span>
        </label>

        {/* Submit */}
        <button type="submit" className="btn-primary w-full">
          Get Your Estimate
        </button>

        {/* Alt contact */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Prefer to talk?{' '}
          <a href={SMS_LINK} className="text-noble-gold hover:underline">
            Text us
          </a>{' '}
          or call{' '}
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="text-noble-gold hover:underline"
          >
            {PHONE_NUMBER}
          </a>
        </p>
      </form>
    </main>
  )
}
