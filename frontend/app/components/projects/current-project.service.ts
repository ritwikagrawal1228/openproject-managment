// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {opServicesModule} from '../../angular-modules';

export class CurrentProjectService {
  private current:{ id:string, identifier:string, name:string };

  constructor(private PathHelper:any) {
    this.detect();
  }

  public get inProjectContext():boolean {
    return this.current !== undefined;
  }

  public get path():string|null {
    if (this.current) {
      return this.PathHelper.projectPath(this.current.identifier);
    }

    return null;
  }

  public get apiv3Path():string|null {
    if (this.current) {
      return this.PathHelper.api.v3.projects.id(this.current.id).toString();
    }

    return null;
  }

  public get id():string|null {
    return this.getCurrent('id');
  }

  public get name():string|null {
    return this.getCurrent('name');
  }

  public get identifier():string|null {
    return this.getCurrent('identifier');
  }

  private getCurrent(key:'id'|'identifier'|'name' ) {
    if (this.current && this.current[key]) {
      return this.current[key].toString();
    }

    return null;
  }

  /**
   * Detect the current project from its meta tag.
   */
  public detect() {
    const element = angular.element('meta[name=current_project]');
    if (element.length) {
      this.current = {
        id: element.data('projectId'),
        name: element.data('projectName'),
        identifier: element.data('projectIdentifier')
      };
    }
  }
}

opServicesModule.service('currentProject', CurrentProjectService);
