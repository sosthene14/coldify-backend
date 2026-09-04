#!/bin/bash
# Script pour appliquer toutes les migrations SQL manuelles

echo "🔄 Application des migrations manuelles..."

# Nom du container Docker
CONTAINER="coldy-db"
DB_USER="coldy"
DB_NAME="coldy"

# Répertoire des migrations
MIGRATIONS_DIR="../migrations"

# Appliquer chaque fichier SQL dans l'ordre
for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    echo "📄 Application de: $(basename $migration_file)"
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$migration_file"
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration appliquée avec succès"
    else
        echo "❌ Erreur lors de l'application de la migration"
        exit 1
    fi
done

echo "🎉 Toutes les migrations ont été appliquées avec succès!"
