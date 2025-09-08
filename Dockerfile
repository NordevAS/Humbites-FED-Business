# Use an official Node.js runtime as a parent image
FROM node:22-alpine AS builder

# Set the working directory inside the container
WORKDIR /src

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port 3001 to the outside world
EXPOSE 3001

# Define the command to run the app
CMD ["npm", "start"]