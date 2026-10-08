# Overview

## Team

- Tanner Aslan (tkaslan)
- Gjonpjer Kola (gjonpjer)
- Calvin Yi (calvinyi)
- Mark Zhu (markzhu)

## The Problem

Traditional campus directories and mapping utilities primarily focus on architectural
layouts and computer lab availability, frequently overlooking critical environmental
and sensory factors such as acoustic levels, ambient lighting quality, and physical
accessibility. As a result, individuals with specific physical accommodations or
sensory processing sensitivities spend a disproportionate amount of time and energy
attempting to locate viable spaces to work and study.

## The Idea

A dynamic, sensory-focused campus mapping application that lets users find study spaces
based strictly on environmental conditions. The platform leverages an interactive map
using GeoJSON building footprints and MPrint layouts to render mapped interiors for
libraries and other study areas. Pre-existing location data — baseline noise levels,
available amenities — is combined with real-time crowd density from the Waitz IoT
occupancy API, giving a comprehensive, real-time snapshot of the campus environment.

## Target Audience

Neurodivergent students, individuals with sensory processing sensitivities, and users
who require specific, step-free physical accommodations.

## "Not-Only-You" Rationale

This concept centers users who experience public spaces differently than the
development team. Standard architectural layouts don't account for how environments
are actually experienced. The application meets this audience's needs by letting them
actively filter out overstimulating environments before traveling to them, using live
occupancy data and acoustic baseline tags. Designing for adaptive furniture, sensory
sensitivities, and physical clearance requires the team to set aside its own baseline
assumptions about physical comfort and actively learn to design for a type of user
unlike themselves — directly addressing implicit biases and incorrect assumptions.

See [Features](features.md) for how this translates into UI, and
[Accessibility](../technical/accessibility.md) for the WCAG compliance approach.
