#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) 2012-2022 the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++

class Activities::ProjectActivityProvider < Activities::BaseActivityProvider
  activity_provider_for type: 'project_attributes',
                        permission: :view_project

  def event_query_projection
    [
      projection_statement(journals_table, :journable_id, 'project_id'),
      projection_statement(projects_table, :identifier, 'project_identifier'),
      projection_statement(projects_table, :name, 'project_name')
    ]
  end

  protected

  def join_with_projects_table(query)
    query.join(projects_table).on(projects_table[:id].eq(journals_table['journable_id']))
  end

  def event_title(event)
    I18n.t('events.title.project', name: event['project_name'])
  end

  def event_path(event)
    url_helpers.project_path(event['project_identifier'])
  end

  def event_url(event)
    url_helpers.project_url(event['project_identifier'])
  end
end
